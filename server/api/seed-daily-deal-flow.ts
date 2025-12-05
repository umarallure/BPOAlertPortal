import { createClient } from '@supabase/supabase-js'
import type { Database } from '~/types/supabase'

export default eventHandler(async (event) => {
  const config = useRuntimeConfig()
  const query = getQuery(event)
  
  const days = parseInt(query.days as string) || 7
  const minPerDay = parseInt(query.minPerDay as string) || 5
  const maxPerDay = parseInt(query.maxPerDay as string) || 15
  
  const supabase = createClient<Database>(
    config.public.supabaseUrl,
    config.public.supabaseKey
  )

  // Data pools from your requirements
  const statusOptions = [
    "Needs BPO Callback",
    "Returned To Center - DQ",
    "Pending Approval",
    "Fulfilled carrier requirements",
    "GI - Currently DQ",
    "Incomplete Transfer",
    "Pending Failed Payment Fix",
    "DQ'd Can't be sold",
    "Application Withdrawn"
  ]

  const carrierOptions = [
    "Liberty", "SBLI", "Corebridge", "MOH", "Transamerica", "RNA",
    "AMAM", "GTL", "Aetna", "Americo", "CICA", "N/A"
  ]

  const productTypeOptions = [
    "Preferred", "Standard", "Graded", "Modified", "GI",
    "Immediate", "Level", "ROP", "N/A"
  ]

  const bufferAgentOptions = [
    "Justine", "Nicole Mejia", "Laiza Batain", "Aqib Afridi", "Qasim Raja",
    "Molli Reynolds", "Noah Akins", "Hussain Khan", "N/A"
  ]

  const agentOptions = [
    "Claudia", "Lydia", "Zack", "Tatumn", "Benjamin", "N/A", "Kaye",
    "Isaac", "Abdul", "Nicole Mejia", "Precy Lou", "Laiza Batain"
  ]

  const licensedAccountOptions = [
    "Claudia", "Lydia", "Isaac", "Abdul", "Trinity", "Benjamin",
    "Tatumn", "Noah", "N/A"
  ]

  const leadVendorOptions = [
    "Ark Tech", "GrowthOnics BPO", "Maverick", "Omnitalk BPO", "Vize BPO",
    "Corebiz", "Digicon", "Ambition", "Benchmark", "Poshenee", "Plexi",
    "Gigabite", "Everline solution", "Progressive BPO", "Cerberus BPO",
    "NanoTech", "Optimum BPO", "Ethos BPO", "Trust Link", "Crown Connect BPO",
    "Quotes BPO", "Zupax Marketing", "Argon Comm", "Care Solutions",
    "Cutting Edge", "Next Era", "Rock BPO", "Avenue Consultancy", "AJ BPO",
    "Pro Solutions BPO", "Emperor BPO", "Networkize", "LightVerse BPO",
    "Leads BPO", "Helix BPO", "CrossNotch", "StratiX BPO", "Exito BPO",
    "Lumenix BPO", "All-Star BPO", "DownTown BPO", "TechPlanet", "Livik BPO",
    "NexGen BPO", "Quoted-Leads BPO", "SellerZ BPO", "Venom BPO",
    "Core Marketing", "WinBPO"
  ]

  const firstNames = [
    "John", "Jane", "Michael", "Emily", "David", "Sarah", "Robert", "Lisa",
    "William", "Jennifer", "James", "Linda", "Richard", "Patricia", "Thomas",
    "Barbara", "Charles", "Elizabeth", "Daniel", "Susan", "Matthew", "Jessica",
    "Anthony", "Karen", "Mark", "Nancy", "Donald", "Betty", "Steven", "Helen"
  ]

  const lastNames = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
    "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
    "Ramirez", "Lewis", "Robinson"
  ]

  // Helper functions
  const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
  const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
  const randomPhone = () => `(${randomInt(200, 999)}) ${randomInt(200, 999)}-${randomInt(1000, 9999)}`
  const randomSubmissionId = () => String(randomInt(1000000000000000, 9999999999999999))
  const randomName = () => `${randomItem(firstNames)} ${randomItem(lastNames)}`

  const generateEntry = (date: Date) => {
    const status = randomItem(statusOptions)
    const isPendingApproval = status === "Pending Approval"

    // Business rule: Pending Approval → Underwriting or Submitted, others → Not Submitted
    const callResult = isPendingApproval
      ? randomItem(["Underwriting", "Submitted"])
      : "Not Submitted"

    // Business rule: carrier, product, premium, face_amount only for Pending Approval
    const carrier = isPendingApproval ? randomItem(carrierOptions) : null
    const productType = isPendingApproval ? randomItem(productTypeOptions) : null
    const monthlyPremium = isPendingApproval ? randomInt(50, 500) : null
    const faceAmount = isPendingApproval ? randomInt(10000, 1000000) : null
    const draftDate = isPendingApproval
      ? new Date(date.getTime() + randomInt(7, 60) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null

    return {
      submission_id: randomSubmissionId(),
      client_phone_number: randomPhone(),
      lead_vendor: randomItem(leadVendorOptions),
      date: date.toISOString().split('T')[0],
      insured_name: randomName(),
      buffer_agent: randomItem(bufferAgentOptions),
      agent: randomItem(agentOptions),
      licensed_agent_account: randomItem(licensedAccountOptions),
      status,
      call_result: callResult,
      carrier,
      product_type: productType,
      draft_date: draftDate,
      monthly_premium: monthlyPremium,
      face_amount: faceAmount,
      from_callback: Math.random() < 0.1,
      is_callback: Math.random() < 0.15,
      notes: isPendingApproval
        ? `Application submitted for ${carrier} ${productType} policy. Premium: $${monthlyPremium}/mo, Coverage: $${faceAmount?.toLocaleString()}`
        : `Status: ${status}. ${callResult}.`
    }
  }

  const entries = []
  const today = new Date()

  // Generate entries for each of the last N days
  for (let i = 0; i < days; i++) {
    const targetDate = new Date(today)
    targetDate.setDate(today.getDate() - i)
    
    const entriesForDay = randomInt(minPerDay, maxPerDay)
    
    for (let j = 0; j < entriesForDay; j++) {
      entries.push(generateEntry(targetDate))
    }
  }

  // Insert in batches
  const { data, error } = await supabase
    .from('daily_deal_flow')
    .insert(entries)
    .select()

  if (error) {
    throw createError({
      statusCode: 500,
      message: error.message
    })
  }

  return {
    success: true,
    inserted: data?.length || 0,
    days,
    message: `Successfully seeded ${data?.length} entries across ${days} days`
  }
})
