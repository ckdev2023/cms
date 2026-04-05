# 签证客户中心 PRD（开发级版本）

## 一、系统定位
本系统为日本行政书士签证公司内部使用的 SaaS 客户中心系统，核心围绕签证案件管理。

---

## 二、核心实体

1. customers（客户主档）
2. person_info（个人信息）
3. company_info（公司信息）
4. visa_cases（签证案件）
5. notes（跟进记录）
6. customer_file_paths（资料路径）

---

## 三、签证案件（visa_cases）

### 字段设计

- id: uuid
- customer_id: 主申请人ID
- case_type: WORK / HIGHLY_SKILLED / BUSINESS / FAMILY / PR / NATURALIZATION
- case_status: INIT / PREPARING / SUBMITTED / REVIEWING / SUPPLEMENT / APPROVED / DONE / CLOSED
- is_family_case: boolean
- family_link_mode: INTERNAL / EXTERNAL

#### 内部主申请人
- internal_primary_customer_id

#### 外部主申请人
- external_primary_name
- external_primary_case_type
- external_primary_expire_date

#### 通用字段
- expire_date
- next_follow_up_at
- material_status
- fee_status
- owner_user_id
- created_at
- updated_at

---

## 四、客户跟进记录（notes 升级）

### 字段新增

- log_type: VISIT / CALL / LINE / SUBMIT / SUPPLEMENT / INTERNAL
- submitted_items: 已提交内容
- missing_items: 缺失材料
- next_action: 下一步动作
- next_follow_up_at: 下次跟进时间

---

## 五、资料路径（customer_file_paths）

- id
- customer_id
- visa_case_id
- path_type: CUSTOMER / CASE / MAIN / SPOUSE / CHILD
- server_path: 本地服务器路径
- remark

---

## 六、页面结构

### 1. 客户列表页
- 搜索 / 筛选 / 分页
- 状态标签（到期 / 补件 / 正常）

### 2. 客户详情页（核心）
模块：
- 基本信息
- 签证案件
- 家属成员
- 材料状态（checklist）
- 跟进记录（时间线）
- 资料路径（复制按钮）

### 3. 新建客户 / 案件
- 主申请人
- 家属动态添加
- 家族签模式选择（内部 / 外部）

### 4. 跟进记录
- 快速录入
- 自动带时间 / 用户

### 5. 提醒页
- 今日待跟进
- 7天内到期
- 2个月内到期
- 补件提醒

---

## 七、开发优先级

### P0
- customers
- person_info
- notes
- customer_file_paths

### P1
- visa_cases

### P2
- materials（材料系统）

---

## 八、关键业务规则

1. 一个案件 = 一个主申请人
2. 主申请人可以有多个家属
3. 家族签支持：
   - 内部主申请人
   - 外部主申请人
4. 文件不入库，仅记录服务器路径

---

## 九、目标

从“客户管理”升级为“签证业务管理系统”
