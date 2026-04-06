/**
 * 简化详情「申请材料清单」卡片：主展示案件、权限门槛与 checklist API（Vitest）。
 *
 * 清单数据与 `CustomerMaterialChecklistTab` 一致：均调用 `GET /visa-cases/:id/materials` 全量，无截断。
 */
/* eslint-disable max-lines-per-function -- 用例内联 mock 数据与挂载，拆散后可读性更差 */
import { flushPromises, mount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import type { Pinia } from "pinia";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { h } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";

import {
  getVisaCaseMaterials,
  getVisaCaseMaterialSummary,
} from "@/api/visa-case";
import { MaterialItemStatusLabel } from "@/constants/enum-labels";
import {
  CustomerStatus,
  CustomerType,
  MaterialItemStatus,
  MaterialStatus,
  ServiceType,
  VisaCaseStatus,
} from "@/constants/enums";
import { P } from "@/constants/permissions";
import { i18n } from "@/i18n";
import { useUserStore } from "@/stores/user";
import type { ApiResponse } from "@/types";
import type {
  CustomerDetail,
  CustomerListPrimaryVisaCaseSummary,
} from "@/types/customer";
import type { MaterialSummary, VisaCaseMaterialItemDetail } from "@/types/visa-case";

import CustomerSimpleMaterialsCard from "./CustomerSimpleMaterialsCard.vue";

vi.mock("@/api/visa-case", () => ({
  getVisaCaseMaterials: vi.fn(),
  getVisaCaseMaterialSummary: vi.fn(),
}));

const getVisaCaseMaterialsMock = vi.mocked(getVisaCaseMaterials);
const getVisaCaseMaterialSummaryMock = vi.mocked(getVisaCaseMaterialSummary);

const CUSTOMER_ID = "b0000000-0000-4000-8000-000000000002";
const VISA_CASE_ID = "c0000000-0000-4000-8000-000000000003";

/**
 * @param overrides - 覆盖主展示案件摘要
 * @returns 最小主展示案件对象
 */
function minimalPrimaryCase(
  overrides: Partial<CustomerListPrimaryVisaCaseSummary> = {},
): CustomerListPrimaryVisaCaseSummary {
  return {
    visaCaseId: VISA_CASE_ID,
    caseType: "WORK",
    caseStatus: VisaCaseStatus.IN_PROGRESS,
    expireDate: null,
    nextFollowUpAt: null,
    assignedToUserId: null,
    assignedToDisplayName: null,
    isFamilyCase: false,
    familyLinkMode: null,
    familyDependentsCount: 0,
    materialStatus: MaterialStatus.PARTIAL,
    materialChecklistTotal: 4,
    materialChecklistCollected: 2,
    materialChecklistNotApplicable: 1,
    materialChecklistSuggestedStatus: MaterialStatus.PARTIAL,
    materialChecklistOutOfSync: false,
    ...overrides,
  };
}

/**
 * @param overrides - 可选覆盖
 * @returns 客户详情
 */
function minimalCustomerDetail(
  overrides: Partial<CustomerDetail> = {},
): CustomerDetail {
  return {
    id: CUSTOMER_ID,
    customerCode: "C-001",
    customerType: CustomerType.PERSONAL,
    customerName: "测试",
    phone: null,
    email: null,
    wechatId: null,
    lineId: null,
    address: null,
    serviceType: ServiceType.BOTH,
    ownerUserId: null,
    ownerName: null,
    status: CustomerStatus.ACTIVE,
    photoFileId: null,
    companyInfo: null,
    personInfo: null,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
    staffRelations: [],
    listPrimaryVisaCase: null,
    ...overrides,
  };
}

/**
 * @param permissions - 权限码
 * @returns Pinia
 */
function initPiniaWithPermissions(permissions: string[]): Pinia {
  const pinia = createPinia();
  setActivePinia(pinia);
  useUserStore(pinia).$patch({
    userInfo: {
      id: "u1",
      username: "t",
      displayName: "T",
      email: "t@t.jp",
      roles: [],
      permissions,
      status: "ACTIVE",
    },
  });
  return pinia;
}

/**
 * @returns 四条材料行，覆盖三种 `MaterialItemStatus` 计数场景
 */
function buildFourMaterialRows(): VisaCaseMaterialItemDetail[] {
  const base = {
    visaCaseId: VISA_CASE_ID,
    templateItemId: null,
    visaCaseFamilyMemberId: null,
    familyMemberName: null,
    groupName: "G",
    remark: null,
    collectedAt: null,
    createdBy: null,
    creatorName: null,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
  };
  return [
    {
      ...base,
      id: "m1",
      itemName: "A",
      itemStatus: MaterialItemStatus.COLLECTED,
      sortOrder: 0,
    },
    {
      ...base,
      id: "m2",
      itemName: "B",
      itemStatus: MaterialItemStatus.COLLECTED,
      sortOrder: 1,
    },
    {
      ...base,
      id: "m3",
      itemName: "C",
      itemStatus: MaterialItemStatus.NOT_COLLECTED,
      sortOrder: 2,
    },
    {
      ...base,
      id: "m4",
      itemName: "D",
      itemStatus: MaterialItemStatus.NOT_APPLICABLE,
      sortOrder: 3,
    },
  ];
}

describe("CustomerSimpleMaterialsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("权限与主展示案件门槛", () => {
    it("无主展示案件时不请求材料接口并展示 noPrimaryCase 文案", async () => {
      i18n.global.locale.value = "zh-CN";
      const pinia = initPiniaWithPermissions([P.VISA_CASE_DETAIL]);
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: "/", component: { render: () => h("div") } }],
      });
      const wrapper = mount(CustomerSimpleMaterialsCard, {
        props: { customer: minimalCustomerDetail({ listPrimaryVisaCase: null }) },
        global: { plugins: [ElementPlus, i18n, pinia, router] },
      });
      await flushPromises();
      expect(getVisaCaseMaterialsMock).not.toHaveBeenCalled();
      expect(getVisaCaseMaterialSummaryMock).not.toHaveBeenCalled();
      expect(wrapper.text()).toContain(
        i18n.global.t("detailViews.customer.contextStrip.noPrimaryCase"),
      );
    });

    it("无签证案件读权限时不请求接口并展示 noVisaPermission", async () => {
      const pinia = initPiniaWithPermissions([]);
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: "/", component: { render: () => h("div") } }],
      });
      const wrapper = mount(CustomerSimpleMaterialsCard, {
        props: {
          customer: minimalCustomerDetail({
            listPrimaryVisaCase: minimalPrimaryCase(),
          }),
        },
        global: { plugins: [ElementPlus, i18n, pinia, router] },
      });
      await flushPromises();
      expect(getVisaCaseMaterialsMock).not.toHaveBeenCalled();
      expect(wrapper.text()).toContain(
        i18n.global.t(
          "detailViews.customer.stitchLayout.simpleMaterialsCard.noVisaPermission",
        ),
      );
    });
  });

  it("有主展示案件与读权限时并行请求摘要与清单并渲染 Stitch 环形进度、清单行与底部操作", async () => {
    i18n.global.locale.value = "zh-CN";
    const pinia = initPiniaWithPermissions([P.VISA_CASE_DETAIL]);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", component: { render: () => h("div") } },
        {
          path: "/customers/:id",
          name: "CustomerDetail",
          component: { render: () => h("div") },
        },
      ],
    });
    await router.push("/");

    const summary: MaterialSummary = {
      total: 4,
      collected: 2,
      notCollected: 1,
      notApplicable: 1,
      currentStatus: MaterialStatus.PARTIAL,
      suggestedStatus: MaterialStatus.PARTIAL,
    };
    getVisaCaseMaterialsMock.mockResolvedValue({
      code: 0,
      message: "ok",
      data: buildFourMaterialRows(),
    } as ApiResponse<VisaCaseMaterialItemDetail[]>);
    getVisaCaseMaterialSummaryMock.mockResolvedValue({
      code: 0,
      message: "ok",
      data: summary,
    } as ApiResponse<MaterialSummary>);

    const wrapper = mount(CustomerSimpleMaterialsCard, {
      props: {
        customer: minimalCustomerDetail({
          listPrimaryVisaCase: minimalPrimaryCase(),
        }),
      },
      global: { plugins: [ElementPlus, i18n, pinia, router] },
    });
    await flushPromises();

    expect(getVisaCaseMaterialsMock).toHaveBeenCalledWith(VISA_CASE_ID);
    expect(getVisaCaseMaterialSummaryMock).toHaveBeenCalledWith(VISA_CASE_ID);
    expect(wrapper.text()).toContain("67%");
    expect(wrapper.text()).toContain("A");
    expect(wrapper.text()).toContain("B");
    expect(wrapper.text()).toContain("C");
    expect(wrapper.text()).toContain("D");
    expect(wrapper.text()).toContain(
      i18n.global.t(
        "detailViews.customer.stitchLayout.simpleMaterialsCard.rowPendingSupplement",
      ),
    );
    expect(wrapper.text()).toContain(MaterialItemStatusLabel[MaterialItemStatus.COLLECTED]);
    expect(wrapper.text()).toContain(MaterialItemStatusLabel[MaterialItemStatus.NOT_APPLICABLE]);
    expect(wrapper.text()).toContain(
      i18n.global.t("detailViews.customer.stitchLayout.urgeSupplementCta"),
    );
    expect(wrapper.text()).toContain(
      i18n.global.t("detailViews.customer.stitchLayout.simpleMaterialsCard.viewAll"),
    );

    const scrollRegion = wrapper.find(".customer-simple-materials-card__rows-scroll");
    expect(scrollRegion.exists()).toBe(true);
    expect(scrollRegion.attributes("role")).toBe("region");
    expect(scrollRegion.attributes("tabindex")).toBe("0");
    expect(scrollRegion.attributes("aria-label")).toBe(
      i18n.global.t("detailViews.customer.stitchLayout.simpleMaterialsCard.materialsListAria"),
    );
    expect(wrapper.findAll(".customer-simple-materials-card__row")).toHaveLength(4);
  });
});
