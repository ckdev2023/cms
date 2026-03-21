import type { CustomerType, ServiceType, CustomerStatus, NoteType } from '@/constants/enums'

export interface CompanyInfoData {
  id?: string
  corporationNumber: string | null
  fiscalMonth: number | null
  representativeName: string | null
}

export interface PersonInfoData {
  id?: string
  nationality: string | null
  residenceStatus: string | null
  residenceExpireDate: string | null
}

export interface CustomerItem {
  id: string
  customerCode: string
  customerType: CustomerType
  customerName: string
  phone: string | null
  email: string | null
  address: string | null
  serviceType: ServiceType
  ownerUserId: string | null
  ownerName: string | null
  status: CustomerStatus
  companyInfo: CompanyInfoData | null
  personInfo: PersonInfoData | null
  createdAt: string
  updatedAt: string
}

export interface CustomerDetail extends CustomerItem {
  staffRelations: {
    id: string
    userId: string
    relationType: string
    user: { id: string; displayName: string }
  }[]
}

export interface CreateCustomerParams {
  customerType: CustomerType
  customerName: string
  phone?: string
  email?: string
  address?: string
  serviceType: ServiceType
  ownerUserId?: string
  companyInfo?: {
    corporationNumber?: string
    fiscalMonth?: number
    representativeName?: string
  }
  personInfo?: {
    nationality?: string
    residenceStatus?: string
    residenceExpireDate?: string
  }
}

export interface UpdateCustomerParams extends Partial<CreateCustomerParams> {}

export interface CustomerQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
  customerType?: CustomerType
  serviceType?: ServiceType
  status?: CustomerStatus
  ownerUserId?: string
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

export interface NoteItem {
  id: string
  customerId: string
  content: string
  noteType: NoteType
  createdBy: string | null
  creatorName: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateNoteParams {
  content: string
  noteType?: NoteType
}

export interface UpdateNoteParams {
  content?: string
  noteType?: NoteType
}

export interface NoteQueryParams {
  page?: number
  pageSize?: number
  noteType?: NoteType
  sortOrder?: 'ASC' | 'DESC'
}
