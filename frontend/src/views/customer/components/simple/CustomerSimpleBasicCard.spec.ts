/**
 * CustomerSimpleBasicCard：键值展示与「查看全部」跳转 `CustomerDetail` + `tab=basic`（Vitest）。
 */
import { flushPromises, mount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import { describe, expect, it, vi } from "vitest";
import { h } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";

import {
  CustomerStatus,
  CustomerType,
  ServiceType,
} from "@/constants/enums";
import { i18n } from "@/i18n";
import type { CustomerDetail } from "@/types/customer";
import { CUSTOMER_DETAIL_RETURN_QUERY_KEY } from "@/utils/customer-detail-return-navigation";

import CustomerSimpleBasicCard from "./CustomerSimpleBasicCard.vue";

/** 与 `VISA_CASE_IMPORT_LOCAL_UUID_RE` 一致的有效测试用 UUID */
const SAMPLE_CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440000";

/**
 * 构造客户详情最小对象，满足 `CustomerDetail` 与组件展示字段。
 *
 * @param overrides - 可选字段覆盖
 * @returns 客户详情
 */
function minimalCustomerDetail(
  overrides: Partial<CustomerDetail> = {},
): CustomerDetail {
  return {
    id: SAMPLE_CUSTOMER_ID,
    customerCode: "C-001",
    customerType: CustomerType.PERSONAL,
    customerName: "山田太郎",
    phone: "090-0000-0000",
    email: "t@example.jp",
    wechatId: null,
    lineId: null,
    address: "大阪府",
    serviceType: ServiceType.BOTH,
    ownerUserId: null,
    ownerName: "担当者",
    status: CustomerStatus.ACTIVE,
    photoFileId: null,
    companyInfo: null,
    personInfo: {
      nationality: "中国",
      passportNumber: "E12345678",
      residenceStatus: "技術・人文知識・国際業務",
      residenceExpireDate: "2026-12-31",
      isFamilyMember: false,
      familyRelation: null,
      primaryCustomerId: null,
      remindDaysBefore: null,
      daysLeft: 100,
      alertLevel: null,
    },
    createdAt: "2026-01-15T10:00:00.000Z",
    updatedAt: "2026-02-01T12:00:00.000Z",
    staffRelations: [],
    ...overrides,
  };
}

/**
 * 简化详情与标准详情路由占位，供本组件 mount 时注入 `vue-router`。
 *
 * @returns 已注册 `CustomerDetailSimple` / `CustomerDetail` 的 memory router
 */
function createCustomerSimpleBasicCardTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/customers/:id/simple",
        name: "CustomerDetailSimple",
        component: { render: () => h("div") },
      },
      {
        path: "/customers/:id",
        name: "CustomerDetail",
        component: { render: () => h("div") },
      },
    ],
  });
}

describe("CustomerSimpleBasicCard", () => {
  it("renders contact subsection heading and BasicInfoTab-style dash placeholders", async () => {
    const router = createCustomerSimpleBasicCardTestRouter();
    await router.push(`/customers/${SAMPLE_CUSTOMER_ID}/simple`);

    const wrapper = mount(CustomerSimpleBasicCard, {
      props: {
        customer: minimalCustomerDetail({
          wechatId: null,
          lineId: null,
        }),
      },
      global: {
        plugins: [ElementPlus, i18n, router],
      },
    });

    expect(wrapper.text()).toContain("連絡先");
    expect(wrapper.text()).toContain("メール");
    expect(wrapper.text()).toContain("C-001");
    expect(wrapper.text()).toContain("個人");
    expect(wrapper.text()).toContain("090-0000-0000");
    expect(wrapper.text()).not.toContain("E12345678");
    expect(wrapper.find('[data-testid="customer-simple-basic-contact-grid"]').exists()).toBe(
      true,
    );
    expect(
      wrapper.find('[data-testid="customer-simple-basic-contact-expanded-channels"]').exists(),
    ).toBe(false);
    expect(wrapper.text()).not.toContain("WeChat");
    expect(wrapper.text()).not.toContain("LINE");
    await wrapper.get('[data-testid="customer-simple-basic-expand"]').trigger("click");
    expect(
      wrapper.find('[data-testid="customer-simple-basic-contact-expanded-channels"]').exists(),
    ).toBe(true);
    expect(wrapper.text()).toContain("WeChat");
    expect(wrapper.text()).toContain("LINE");
    expect(wrapper.text()).toContain("E12345678");
  });

  it("pushes CustomerDetail with tab=basic and ccFrom simple path when View all clicked", async () => {
    const router = createCustomerSimpleBasicCardTestRouter();
    const pushSpy = vi.spyOn(router, "push");

    await router.push(`/customers/${SAMPLE_CUSTOMER_ID}/simple`);

    const wrapper = mount(CustomerSimpleBasicCard, {
      props: { customer: minimalCustomerDetail() },
      global: {
        plugins: [ElementPlus, i18n, router],
      },
    });

    pushSpy.mockClear();
    const viewAllBtn = wrapper
      .findAll(".el-button")
      .find((b) => b.text().includes("すべて表示"));
    expect(viewAllBtn).toBeDefined();
    await viewAllBtn!.trigger("click");
    await flushPromises();

    expect(pushSpy).toHaveBeenCalled();
    const arg = pushSpy.mock.calls[0]?.[0];
    expect(arg).toMatchObject({
      name: "CustomerDetail",
      params: { id: SAMPLE_CUSTOMER_ID },
    });
    const q = (arg as { query: Record<string, string> }).query;
    expect(q.tab).toBe("basic");
    const ccFrom = q[CUSTOMER_DETAIL_RETURN_QUERY_KEY];
    expect(typeof ccFrom).toBe("string");
    expect(ccFrom as string).toContain("/simple");
  });
});
