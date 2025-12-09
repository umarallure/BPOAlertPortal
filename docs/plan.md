
## **📋 PROJECT PLAN: Insurance Sales Alert Portal**

### **Phase 0: Foundation & Setup** (Week 1)
**Goal:** Establish development environment and core infrastructure

#### **Tasks:**

1. **Supabase Setup**
   - Project is Created Just set it up Mcp is Connect the project name is  BPO Alert Portal
   - Set up database schema (tables from PRD section 5.2)
   - Create Row Level Security (RLS) policies
   - Generate TypeScript types from database

2. **Development Environment**
   - Install Supabase client libraries (`@supabase/supabase-js`)
   - Configure environment variables
   - Set up Supabase auth middleware in Nuxt
   - Create API composables for Supabase integration

3. **Database Schema Implementation**
   - Create `centers` table
   - Create `alert_rules` table
   - Create `alerts_sent` table
   - Create `dq_items` table
   - Create `corrective_actions` table
   - Create `notification_preferences` table
   - Create `mobile_devices` table
   - Enhance existing `daily_deal_flow` table
   - Create indexes for performance

**Deliverables:** Supabase project configured, database schema deployed, Nuxt app connected to Supabase


### **Phase 1: Core Dashboard & Real-Time Data**
**Goal:** Build the foundational dashboard with live metrics

#### **Tasks:**
1. **Authentication & Authorization**
   - Login/logout pages

2. **Page 2: Daily Deal Flow**
   - Daily Deal Flow Data on the Grid
3. **Page 3: Overview Dashboard**
   - Total Transfer Count From Daily Deal Flow
   - Total Sales Volume Count Entries Having the Status Pending Approval
   - Total Underwriting Volume (Number for Pending Approval status entries having call status as underwiting)
   - Approval Rate Percentage with visual indicators Total Transfer vs  Total Approval
   - Callback Rate Display Transfer vs Call back status entires
   - DQ Rate Total Transfer VS Entries having the DQ Status

4. **Real-Time Data Layer**
   - Supabase real-time subscriptions for `daily_deal_flow`
   - Auto-refresh mechanism for metrics

5. **Page 4: BPO Center Performance**
   - Sales count vs target per center in the form of Cards each BPO will have one Card and soreting will be having the center highest sales
   - Total Transfer Count per Center  
   - Toatl DQ Count  per per center
   - Approval ratio (transfer vs submission) per center
   - Trend indicators (↑↓ vs yesterday)

**Deliverables:** Functional dashboard showing real-time metrics, user authentication working

### **Phase 2: Advanced Analytics & Customization** (Weeks 11-12)
**Goal:** Add advanced features and configurability

#### **Tasks:**
1. **BPO Ranking System to the Page 2: BPO Center Performance**
   - Performance-based ranking algorithm for each center based on trnasfer to approved ratio,DQ ratio
   - Leaderboard visualization based on the ranking and ctagorize them into color codded 
   - Conditional formatting (Green/Yellow/Red)
   - Historical ranking trends

3. **Threshold Configuration (4.5.1)**
   - Admin interface for setting targets for each Center Sales and Trnasfers
   - DQ acceptable percentage for each center

**Deliverables:** Configurable alert system, ranking dashboard



### **Phase 3: Alert Engine & Notification System** (Weeks 6-8)
**Goal:** Build intelligent alert system with multi-channel delivery

#### **Tasks:**
1. **Alert Rules Engine** (✅ Completed)
   - Background job scheduler (using Supabase Edge Functions or cron)
   - Rule evaluation engine (4.2.1 triggers)
   - Threshold monitoring service
   - Alert priority system

2. **Alert Types Implementation** (✅ Completed)
   - Low Sales Volume alerts per center based on their Threshold Configuration (4.5.1)
   - Zero Sales Alert (CRITICAL) for all center
   - High DQ Rate alerts For all centers
   - Low Approval Ratio alerts For all centers
   - Milestone Achievement alerts for All Centers
   - Below Threshold Duration alerts For all Center 
   - Should be able to customize the Message and sender each time for these alerts

3. **Slack Integration** (✅ Completed)
   - Slack webhook configuration
   - Channel-based routing each center will have thoer own cahnnel where we have to send the messages or allerts
   - Rich message formatting with metrics

5. **Scheduled Alerts (4.2.2)** (✅ Completed)
   - Daily Morning Brief (08:00 AM)
   - Mid-Day Check-in (01:00 PM)
   - End-of-Day Summary (05:00 PM)
   - Weekly Performance Report (Friday 05:00 PM)
   - Monthly Performance Report (Last day of month)

**Deliverables:** Fully functional alert system with Slack and email notifications


### **Phase 4: Quality Management & DQ Tracking** (Weeks 9-10)
**Goal:** Implement quality assurance and compliance features

#### **Tasks:**
1. **DQ Tracking Dashboard (4.3.1)**
   - Daily DQ items by center
   - DQ rate trend charts (7-day, 30-day)
   - Top DQ issues by frequency
   - DQ items linked to specific agents
   - Auto-flag consecutive high DQ days
   - Notes and Feedback Comment workflow on these DQs by agents

**Deliverables:** Quality management system with DQ tracking and corrective actions

### **Phase 5: Mobile Push Notifications** (Weeks 13-14)
**Goal:** Implement iOS/Android push notification support

#### **Tasks:**
1. **Mobile Device Registration**
   - Device token registration API
   - User device management
   - APNs (iOS) certificate setup
   - FCM (Android) configuration

2. **Push Notification Service**
   - Push notification dispatcher (Supabase Edge Function)
   - Priority-based delivery (Critical/High/Medium/Low)
   - Deep linking to dashboard screens
   - Badge management

**Deliverables:** Mobile push notification system for iOS and Android

---

---
### **Phase 6: Performance Tracking & Reporting** (Weeks 4-5)
**Goal:** Implement historical tracking and automated reports

#### **Tasks:**
1. **Daily Performance Reports**
   - 7/14/30-day performance views
   - Filterable by date range
   - Exportable reports (CSV/PDF)
   - Performance comparison charts

2. **Weekly Performance Reports**
   - Per-center breakdown
   - Capture: Transfers, Sales, Approvals, UW, DQ, Callbacks
   - Week-over-week trends
   - Top/bottom performer identification

3. **Hourly Tracking**
   - Sales & Transfers by hour
   - Time-series charts using Unovis/Chart.js
   - Heatmap visualization for performance patterns

4. **Analytics & Insights**
   - Auto-adjust daily targets based on historical trends
   - Seasonal pattern detection
   - Conversion funnel visualization (transfers → submissions → approvals)

**Deliverables:** Complete reporting suite with historical data analysis

---


### **Phase 7: User Management & Admin Portal** (Week 15)
**Goal:** Complete administration and user management features


### **Phase 8: Testing, Optimization & Launch** (Weeks 16-17)
**Goal:** Ensure production readiness


## **🏗️ Technical Stack Summary**

| **Layer** | **Technology** |
|-----------|---------------|
| **Frontend** | Nuxt 4, Vue 3, Nuxt UI, TailwindCSS, Unovis Charts |
| **Backend** | Nuxt Server API, Supabase Edge Functions |
| **Database** | Supabase (PostgreSQL) |
| **Real-Time** | Supabase Realtime (WebSocket) |
| **Authentication** | Supabase Auth |
| **Notifications** | Slack API, SendGrid/Resend, APNs, FCM |
| **Hosting** | Vercel/Netlify (Frontend), Supabase (Backend) |
| **Monitoring** | Sentry, Supabase Logs |

---

## **📊 Success Metrics Tracking**

| **Metric** | **Target** | **Measurement** |
|------------|-----------|----------------|
| Alert delivery time | < 5 minutes | Alert timestamp - trigger timestamp |
| System uptime | 95%+ | Supabase + Frontend uptime |
| Target miss reduction | 30% reduction | Compare pre/post launch data |
| User adoption | 80%+ | Active users / total users |
| DQ improvement | Measurable trend | Monthly DQ% tracking |
