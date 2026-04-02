import { z } from "zod"

// --- Job Listing (search results) ---

export const JobListingSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  jobType: z.string().nullable(),
  salary: z.string().nullable(),
  url: z.string(),
  posted: z.string().nullable(),
  deadline: z.string().nullable(),
  source: z.enum(["linkedin", "indeed"]),
})

export type JobListing = z.infer<typeof JobListingSchema>

// --- Job Detail (full posting) ---

export const CompanyInfoSchema = z.object({
  name: z.string(),
  logo: z.string().nullable(),
  url: z.string().nullable(),
})

export type CompanyInfo = z.infer<typeof CompanyInfoSchema>

export const JobDetailSchema = JobListingSchema.extend({
  description: z.string(),
  employmentType: z.array(z.string()),
  remote: z.string().nullable(),
  companyInfo: CompanyInfoSchema,
  requirements: z.string().nullable(),
})

export type JobDetail = z.infer<typeof JobDetailSchema>

// --- Search Filters ---

export const SearchFiltersSchema = z.object({
  keywords: z.string().nullable().default(null),
  location: z.string().default("United Kingdom"),
  radius: z.number().nullable().default(null),
  jobType: z.string().nullable().default(null),
  remote: z.string().nullable().default(null),
  salary: z.string().nullable().default(null),
  datePosted: z.string().nullable().default(null),
  experienceLevel: z.string().nullable().default(null),
  limit: z.number().default(25),
})

export type SearchFilters = z.infer<typeof SearchFiltersSchema>

// --- Search Response ---

export interface SearchResponse {
  meta: { total: number }
  results: JobListing[]
}
