import { describe, expect, it } from 'vitest'

import { serializeGlobalVisaCaseQuery } from '@/api/visa-case'
import { VisaCaseStatus, VisaDataScope, VisaReminderType } from '@/constants/enums'

import { buildVisaRegistryStatsQueryParams } from './visa-case-registry-list-stats-parity'

describe('visa-case-registry-list-stats-parity (C1 registry smoke)', () => {
  describe('buildVisaRegistryStatsQueryParams', () => {
    it('merges search fields with dataScope for stats API surface', () => {
      expect(
        buildVisaRegistryStatsQueryParams(
          {
            customerKeyword: '  acme  ',
            caseStatuses: [VisaCaseStatus.IN_PROGRESS],
          },
          VisaDataScope.TEAM,
        ),
      ).toEqual({
        customerKeyword: '  acme  ',
        caseStatuses: [VisaCaseStatus.IN_PROGRESS],
        dataScope: VisaDataScope.TEAM,
      })
    })
  })

  describe('serialized GET /visa-cases vs GET /visa-cases/stats', () => {
    it('matches list query keys when pagination keys are stripped from list serialization', () => {
      const base = buildVisaRegistryStatsQueryParams(
        {
          caseStatuses: [VisaCaseStatus.SUPPLEMENT, VisaCaseStatus.IN_PROGRESS],
          reminderBucket: VisaReminderType.TODAY_FOLLOW_UP,
          supplementRelated: true,
        },
        VisaDataScope.ALL,
      )
      const listSerialized = serializeGlobalVisaCaseQuery({
        ...base,
        page: 3,
        pageSize: 50,
      })
      const statsSerialized = serializeGlobalVisaCaseQuery(base)
      const { page: _p, pageSize: _s, ...listWithoutPagination } = listSerialized
      void _p
      void _s
      expect(statsSerialized).toEqual(listWithoutPagination)
    })
  })
})
