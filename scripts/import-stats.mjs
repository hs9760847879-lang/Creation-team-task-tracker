import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const dailyStats = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'data', 'daily-stats.json'), 'utf-8')
)

const agentStats = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'data', 'daily-agent-stats.json'), 'utf-8')
)

async function importDailyStats() {
  console.log(`Importing ${dailyStats.length} daily stats rows...`)
  const { data, error } = await supabase.from('daily_stats').upsert(
    dailyStats.map((r) => ({
      date: r.date,
      total_commission_updated: r.total_commission_updated,
      total_commission_created: r.total_commission_created,
      number_of_mails_assigned: r.number_of_mails_assigned,
      number_of_properties_created: r.number_of_properties_created,
      number_of_faqs_updated: r.number_of_faqs_updated,
      day_of_week: r.day_of_week,
      total_properties_api_enabled: r.total_properties_api_enabled,
      video_created: r.video_created,
      stagging_property_creation: r.stagging_property_creation,
    })),
    { onConflict: 'date' }
  )
  if (error) {
    console.error('Error importing daily stats:', error)
  } else {
    console.log(`✓ Imported ${data?.length || 0} daily stats rows`)
  }
}

async function importAgentStats() {
  console.log(`Importing ${agentStats.length} agent stats rows...`)
  const { data, error } = await supabase.from('daily_agent_stats').upsert(
    agentStats.map((r) => ({
      date: r.date,
      agent_name: r.agent_name,
      commission_updated: r.commission_updated,
      commission_created: r.commission_created,
      properties_created: r.properties_created,
    })),
    { onConflict: 'date,agent_name' }
  )
  if (error) {
    console.error('Error importing agent stats:', error)
  } else {
    console.log(`✓ Imported ${data?.length || 0} agent stats rows`)
  }
}

async function main() {
  console.log('Starting data import...')
  await importDailyStats()
  await importAgentStats()
  console.log('Done!')
}

main()
