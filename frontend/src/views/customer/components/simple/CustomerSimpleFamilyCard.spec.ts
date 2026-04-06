/**
 * 简化详情「家庭成员」卡片：权限门槛、随附家属列表与签证域深链（Vitest）。
 */
/* eslint-disable max-lines-per-function -- 用例内联路由与 mock，拆散后可读性更差 */
import { flushPromises, mount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import type { Pinia } from "pinia";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { h } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";

import { getCustomers } from "@/api/customer";
import {
  CustomerStatus,
  CustomerType,
  FamilyRelation,
  ServiceType,
} from "@/constants/enums";
import { P } from "@/constants/permissions";
import { i18n } from "@/i18n";
import { useUserStore } from "@/stores/user";
import type { ApiResponse } from "@/types";
import type { PaginatedResponse } from "@/types/api";
import type { CustomerDetail, CustomerItem } from "@/types/customer";

import CustomerSimpleFamilyCard from "./CustomerSimpleFamilyCard.vue";

vi.mock("@/api/customer", () => ({
  getCustomers: vi.fn(),
}));

const getCustomersMock = vi.mocked(getCustomers);

const PRIMARY_ID = "a0000000-0000-4000-8000-000000000001";

/**
 * 构造挂载卡片所需的最小 `CustomerDetail`（仅需 `id` 与列表拉取同源字段）。
 *
 * @returns 与 `GET /customers/:id` 对齐的最小详情对象
 */
function minimalCustomerDetail(): CustomerDetail {
  return {
    id: PRIMARY_ID,
    customerCode: "C-P",
    customerType: CustomerType.PERSONAL,
    customerName: "主客户",
    phone: null,
    email: null,
    wechatId: null,
    lineId: null,
    address: null,
    serviceType: ServiceType.ADMIN,
    ownerUserId: null,
    ownerName: null,
    status: CustomerStatus.ACTIVE,
    photoFileId: null,
    companyInfo: null,
    personInfo: null,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
    staffRelations: [],
  };
}

/**
 * 构造随附家属列表行的最小 `CustomerItem`，便于断言关系圈与副标题。
 *
 * @param overrides - 覆盖默认字段的可选片段
 * @returns 与 `GET /customers` 列表项对齐的对象
 */
function minimalDependent(overrides: Partial<CustomerItem> = {}): CustomerItem {
  const base: CustomerItem = {
    id: "d0000000-0000-4000-8000-0000000000a1",
    customerCode: "C-DEP",
    customerType: CustomerType.PERSONAL,
    customerName: "家属甲",
    phone: null,
    email: null,
    wechatId: null,
    lineId: null,
    address: null,
    serviceType: ServiceType.ADMIN,
    ownerUserId: null,
    ownerName: null,
    status: CustomerStatus.ACTIVE,
    photoFileId: null,
    companyInfo: null,
    personInfo: {
      nationality: "中国",
      passportNumber: null,
      residenceStatus: null,
      residenceExpireDate: null,
      isFamilyMember: true,
      familyRelation: FamilyRelation.SPOUSE,
      primaryCustomerId: PRIMARY_ID,
      remindDaysBefore: null,
      daysLeft: null,
      alertLevel: null,
    },
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
  };
  return { ...base, ...overrides };
}

/**
 * 使用给定权限初始化 Pinia 用户态并设为当前 store。
 *
 * @param permissions - 模拟用户权限码列表
 * @returns 供 `global.plugins` 挂载的 Pinia 实例
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

describe("CustomerSimpleFamilyCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.global.locale.value = "zh-CN";
  });

  it("无 customer:list 权限时展示说明且不请求列表", () => {
    const pinia = initPiniaWithPermissions([]);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: "/customers/:id/simple",
          name: "SimpleStub",
          component: { render: () => h("div") },
        },
      ],
    });
    const wrapper = mount(CustomerSimpleFamilyCard, {
      props: { customer: minimalCustomerDetail() },
      global: { plugins: [ElementPlus, i18n, pinia, router] },
    });
    expect(wrapper.find(".customer-simple-section-card").exists()).toBe(true);
    expect(wrapper.text()).toContain(
      i18n.global.t(
        "detailViews.customer.stitchLayout.simpleFamilyCard.needListPermission",
      ),
    );
    expect(getCustomersMock).not.toHaveBeenCalled();
  });

  it("有权限时拉取随附家属、展示前两行与「还有 N 人」，并在签证管理按钮上附带深链 query", async () => {
    const pinia = initPiniaWithPermissions([P.CUSTOMER_LIST]);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: "/customers/:id/simple",
          name: "SimpleStub",
          component: { render: () => h("div") },
        },
        {
          path: "/customers/:id",
          name: "CustomerDetail",
          component: { render: () => h("div") },
        },
      ],
    });
    await router.push(`/customers/${PRIMARY_ID}/simple`);

    const deps: CustomerItem[] = [
      minimalDependent({
        id: "d0000000-0000-4000-8000-0000000000b1",
        customerName: "子客户A",
        personInfo: {
          ...minimalDependent().personInfo!,
          familyRelation: FamilyRelation.CHILD,
          nationality: "日本",
        },
      }),
      minimalDependent({
        id: "d0000000-0000-4000-8000-0000000000b2",
        customerName: "子客户B",
      }),
      minimalDependent({
        id: "d0000000-0000-4000-8000-0000000000b3",
        customerName: "子客户C",
      }),
    ];
    const payload: ApiResponse<PaginatedResponse<CustomerItem>> = {
      code: 0,
      message: "ok",
      data: { items: deps, page: 1, pageSize: 100, total: 3 },
    };
    getCustomersMock.mockResolvedValueOnce(payload);

    const pushSpy = vi.spyOn(router, "push");

    const wrapper = mount(CustomerSimpleFamilyCard, {
      props: { customer: minimalCustomerDetail() },
      global: { plugins: [ElementPlus, i18n, pinia, router] },
    });
    await flushPromises();

    expect(getCustomersMock).toHaveBeenCalledWith(
      expect.objectContaining({
        primaryCustomerId: PRIMARY_ID,
        page: 1,
        pageSize: 100,
      }),
    );
    expect(wrapper.get('[data-testid="customer-simple-family-summary"]').text()).toBe(
      i18n.global.t(
        "detailViews.customer.stitchLayout.simpleFamilyCard.memberSummary",
        { count: 3 },
      ),
    );
    expect(wrapper.findAll(".customer-simple-family-card__row")).toHaveLength(
      2,
    );
    expect(wrapper.get('[data-testid="customer-simple-family-more"]').text()).toBe(
      i18n.global.t(
        "detailViews.customer.stitchLayout.simpleFamilyCard.moreMembers",
        { count: 1 },
      ),
    );

    await wrapper
      .get('[data-testid="customer-simple-family-open-visa"]')
      .trigger("click");
    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "CustomerDetail",
        params: { id: PRIMARY_ID },
        query: expect.objectContaining({
          tab: "visa-domain",
          visaDomainBlock: "family",
        }),
      }),
    );
  });
});
