import { NotFoundException } from '@nestjs/common';

import {
  createMockDocument,
  createMockPeriod,
  createMockWorkItem,
  createTaxServiceContext,
  type MockCompletedByUser,
} from './tax.service.spec-helpers';

describe('TaxService document mutations', () => {
  it('creates documents and sets receivedAt when received is true', async () => {
    const { service, periodRepo, documentRepo } = createTaxServiceContext();
    const mockPeriod = createMockPeriod();
    periodRepo.findOne.mockResolvedValue(mockPeriod);
    documentRepo.save
      .mockResolvedValueOnce(createMockDocument({ id: 'doc-new' }))
      .mockResolvedValueOnce(
        createMockDocument({ id: 'doc-new', received: true }),
      );
    documentRepo.find.mockResolvedValue([]);

    const result = await service.createDocument('period-1', {
      documentName: '元帳',
    });
    await service.createDocument('period-1', {
      documentName: '元帳',
      received: true,
    });

    const createdDocument = (
      documentRepo.create.mock.calls as Array<
        [{ received: boolean; receivedAt: Date | null }]
      >
    )[1][0];

    expect(result.id).toBe('doc-new');
    expect(documentRepo.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        taxPeriodId: 'period-1',
        documentName: '元帳',
        received: false,
      }),
    );
    expect(createdDocument.receivedAt).toBeInstanceOf(Date);
  });

  it('updates document receiving state and throws when missing', async () => {
    const { service, periodRepo, documentRepo } = createTaxServiceContext();
    const baseDoc = createMockDocument({
      received: true,
      receivedAt: new Date(),
    });
    periodRepo.findOne.mockResolvedValue(createMockPeriod());
    documentRepo.find.mockResolvedValue([]);
    documentRepo.findOne
      .mockResolvedValueOnce(baseDoc)
      .mockResolvedValueOnce(createMockDocument({ received: false }))
      .mockResolvedValueOnce(null);

    await service.updateDocument('doc-1', { received: false });
    await service.updateDocument('doc-1', { received: true });

    expect(documentRepo.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        received: false,
        receivedAt: null,
      }),
    );
    expect(documentRepo.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        received: true,
      }),
    );
    await expect(
      service.updateDocument('missing', { documentName: 'x' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('removes a document and recalculates material status', async () => {
    const { service, periodRepo, documentRepo } = createTaxServiceContext();
    const mockDoc = createMockDocument();
    documentRepo.findOne.mockResolvedValue(mockDoc);
    documentRepo.find.mockResolvedValue([]);
    periodRepo.findOne.mockResolvedValue(createMockPeriod());

    await service.removeDocument('doc-1');

    expect(documentRepo.remove).toHaveBeenCalledWith(mockDoc);
  });
});

describe('TaxService work item mutations', () => {
  it('creates a work item with default completion state', async () => {
    const { service, periodRepo, workItemRepo } = createTaxServiceContext();
    periodRepo.findOne.mockResolvedValue(createMockPeriod());
    workItemRepo.save.mockResolvedValue(createMockWorkItem({ id: 'item-new' }));

    const result = await service.createWorkItem('period-1', {
      itemName: '仕訳入力',
    });

    expect(result.id).toBe('item-new');
    expect(workItemRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        taxPeriodId: 'period-1',
        itemName: '仕訳入力',
        completed: false,
      }),
    );
  });

  it('updates completion state, clears metadata, and throws when missing', async () => {
    const { service, workItemRepo } = createTaxServiceContext();
    workItemRepo.findOne
      .mockResolvedValueOnce(createMockWorkItem({ completed: false }))
      .mockResolvedValueOnce(
        createMockWorkItem({
          completed: true,
          completedAt: new Date(),
          completedBy: 'user-1',
        }),
      )
      .mockResolvedValueOnce(null);

    await service.updateWorkItem('item-1', { completed: true }, 'user-1');
    await service.updateWorkItem('item-1', { completed: false }, 'user-1');

    expect(workItemRepo.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        completed: true,
        completedBy: 'user-1',
      }),
    );
    expect(workItemRepo.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        completed: false,
        completedAt: null,
        completedBy: null,
      }),
    );
    await expect(
      service.updateWorkItem('missing', { itemName: 'x' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('removes a work item and throws for missing records', async () => {
    const { service, workItemRepo } = createTaxServiceContext();
    const mockItem = createMockWorkItem();
    workItemRepo.findOne
      .mockResolvedValueOnce(mockItem)
      .mockResolvedValueOnce(null);

    await service.removeWorkItem('item-1');
    expect(workItemRepo.remove).toHaveBeenCalledWith(mockItem);

    await expect(service.removeWorkItem('missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('TaxService response mappers', () => {
  it('maps period list counters and detail payloads', () => {
    const { service } = createTaxServiceContext();
    const period = createMockPeriod({
      documents: [
        createMockDocument({ received: true }),
        createMockDocument({ id: 'doc-2', received: false }),
        createMockDocument({ id: 'doc-3', received: true }),
      ],
      workItems: [
        createMockWorkItem({ completed: true }),
        createMockWorkItem({
          id: 'item-2',
          completed: false,
          completedByUser: {
            displayName: '担当者B',
          } as MockCompletedByUser,
        }),
      ],
    });

    const listDto = service.toPeriodListDto(period);
    const detailDto = service.toPeriodDetailDto(period);

    expect(listDto.documentCount).toBe(3);
    expect(listDto.documentReceivedCount).toBe(2);
    expect(listDto.workItemCount).toBe(2);
    expect(listDto.workItemCompletedCount).toBe(1);
    expect(detailDto.documents[0].documentName).toBe('元帳');
    expect(detailDto.workItems[1].completedByName).toBe('担当者B');
  });

  it('handles empty documents and work items', () => {
    const { service } = createTaxServiceContext();
    const dto = service.toPeriodListDto(
      createMockPeriod({
        documents: [],
        workItems: [],
      }),
    );

    expect(dto.documentCount).toBe(0);
    expect(dto.documentReceivedCount).toBe(0);
    expect(dto.workItemCount).toBe(0);
    expect(dto.workItemCompletedCount).toBe(0);
  });
});
