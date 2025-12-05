Product Requirements Document (PRD)
Insurance Sales Alert Portal Dashboard
Document Version: 1.0
 Last Updated: December 2024
 Status: Ready for Development

1. Executive Summary
The Insurance Sales Alert Portal is an internal tool designed to automate BPO performance tracking, real-time monitoring, and multi-channel alerting for the insurance team. The system will provide real-time visibility into daily sales metrics, quality issues, and operational performance with intelligent notifications sent to Slack, email, mobile apps (iOS/Android), and WhatsApp.
Primary Goal: Enable proactive performance management through real-time alerts, automated reporting, and data-driven insights across BPO centers.

2. Product Overview
2.1 Vision
Create a unified, real-time performance monitoring and alert system that enables insurance team leaders to identify underperforming centers instantly and take corrective action before targets are missed.
2.2 Scope
Real-time dashboard with performance metrics
Multi-channel notification system (Slack, Email, Mobile Push)
Automated alert triggers based on performance thresholds
Daily, weekly, and monthly reporting
Quality and compliance tracking
Center-level and agent-level performance visibility

2.3 Success Metrics
Alert delivery within 5 minutes of threshold breach
95% uptime for dashboard and notification system
Reduction in missed sales targets by 30%
Improved quality scores through automated DQ tracking
80%+ adoption rate among insurance team and BPO centers


Admin/Platform Owner
Usage: Set alert thresholds, manage users, receive critical iOS push notifications


4. Core Features
4.1 Real-Time Dashboard
4.1.1 Overview Dashboard
Current Date Performance Summary


Total Sales Volume (Total Entries having status Pending Approval and call result is Submitted)
Total Underwriting Sales Volume (Total Entries having status Pending Approval and call result is Underwriting)
Transfer count(Total Number of entries for the Day)
Approval rate percentage (Entries having status Pending Approval/Total entries * 100) Also numbers as well
Callback rate
Color-coded status indicators (Green/Yellow/Red) for centers performing low 
Sales count vs. target target will can set for each center
DQ percentage(Multiple status count in DQ) for each center
Approval ratio transfer vs submission submission having status pending approval (For each center)
Trend indicators (↑↓ vs. yesterday/last week)
Individual center sales count
Daily performance Report (7/14/30 days)
Weekly performance Report for each Center
Capture Transfers, Sales, Approvals, UW, DQ, Callbacks for each Center
Central dashboard for all BPOs (similar to Daily Deal Flow)
Hourly tracking: Sales & Transfers
Auto-adjust daily targets based on historical trends
Monitor transfers and callback rates


4.2 Automated Alert System
4.2.1 Real-Time Performance Alerts
Trigger: Low Sales Volume
Condition: Sales count < target by X% OR 0 sales in Y hours for a particular center , sales target need to be setup first for each center by Admin setting.
Alert Message: "Center [Name] - Only 2 sales done with 2 hours remaining. Daily target: 10 sales"
Recipients: Center Manager, Sales Lead
Channels: Slack
Action Items: View center dashboard, call center manager
Trigger: Zero Sales Alert (CRITICAL)
Condition: No sales in designated time window (e.g., 12:00 PM)
Alert Message: "🚨 CRITICAL: [Center Name] has 0 sales by 12 PM. Immediate action required."
Recipients: Sales Manager, Center Director, Admin
Channels: Slack (urgent)
Priority: High
Trigger: High DQ Rate
Condition: DQ% > acceptable threshold (default: 15%)
Alert Message: "[Center] Quality Alert: 18% DQ rate. Top issues: [Issue 1, Issue 2]"
Recipients: QA Lead, Center Director, Sales Manager
Channels: Slack
Action Items: View DQ details, assign corrective action
Trigger: Low Approval Ratio
Condition: Approval rate < threshold (default: 75%) sales going to underwriting threshold need to be set up system wide for each carrier.
On each carrier if the entry having status pending approval and call result is underwriting then we need to 
Alert Message: "[Center] - Approval ratio at 68%. 2 cases pending carrier response. Need to switch Carrier"
Recipients: Sales Manager, Center Channels
Channels: Slack, Email


Trigger: Milestone Achievement
Condition: Center reaches 75%, 100%, 125% of target
Alert Message: "🎉 [Center] has reached 125% of daily target! Keep up the momentum."
Recipients: Center Team, Sales Manager
Channels: Slack, Email (motivational)
Priority: Low
Trigger: Below Threshold Duration Alert
Condition: Center below target for X consecutive hours
Alert Message: "[Center] below target for 4 consecutive hours. Current: 3/10 target. Time to adjust strategy."
Recipients: Sales Manager
Channels: Slack, Email
Notify for:
Low sales
	High DQ
	High callback rate
	Call backs notifications
Alerts can be sent to managers for immediate action
5. Reporting Automation
Daily: Transfers, submissions, UW performance


Underwriritn > greater than therold per cearrier swirch carrier send message to the slack


Weekly: Trends, top/bottom performers, quality insights


Monthly: Full performance summary, conversion rates from transfers → submissions

 Dashboard & Workflow Enhancements
Rank BPOs based on performance 


Conditional formatting to show strong vs weak performers


Visual cues (Green = good, Yellow = moderate, Red = needs attention)

7. Motivation & Recognition Automation
Milestone alerts when BPOs near targets


Automated congratulatory messages for top performers

8. Warning & Risk Analysis
Early warning alerts for underperformance


Daily updates highlighting underperformers ,Track improvement over time
4.2.2 Scheduled Alerts
Daily Morning Brief (08:00 AM)
Previous day performance summary
Today's targets
Top/bottom 3 performers
Critical issues to address
Recipients: Sales Manager, Admin
Channels: Email, Slack
Mid-Day Check-in (01:00 PM)
Current performance vs. target (hourly)
Centers at risk (below 50% of proportional target)
Active quality issues
Top performer highlight
Recipients: Sales Manager, QA Lead
Channels: Slack, Mobile Push
End-of-Day Summary (05:00 PM)
Daily final performance
Target achievement status
Quality summary
Tomorrow's priorities
Recipients: All stakeholders
Channels: Email, Slack
Weekly Performance Report (Friday 05:00 PM)
Weekly performance by center
Trend analysis (up/down week-over-week)
Quality performance summary
Top 3 performers with incentives
Bottom 3 performers with action plans
Recipients: Sales Manager, BPO Directors, Executives
Channels: Email, Slack
Monthly Performance Report (Last Day of Month)
Month-over-month analysis
Center rankings
Year-to-date performance
Seasonal insights
Compliance status
Recipients: Leadership, Finance
Channels: Email (PDF export)
4.2.3 Multi-Channel Notification Delivery
Slack Integration
Channel-based alerts (#sales-alerts, #quality-alerts, #critical-alerts)
Interactive buttons (View Dashboard, Mark as Reviewed, Acknowledge)
Message threading for alert context
Rich formatting with metrics


Mobile Push Notifications (iOS & Android)
Critical alerts: Immediate push + sound + badge
High priority alerts: Push notification
Low priority: Background notification
Deep link to dashboard screen
Allow/deny permissions per alert type



4.3 Quality & Compliance Management
4.3.1 DQ Tracking
Daily DQ items by center
DQ rate trend (7-day, 30-day)
Top DQ issues by frequency
DQ items linked to specific agents
Auto-flag if DQ% > threshold for consecutive days
Metric selection
Chart/table export
Scheduled report generation
4.5 Configuration & Administration
4.5.1 Threshold Configuration
Sales targets (daily, adjustable by season)
DQ acceptable percentage
Approval ratio minimum
Call duration targets
Customizable per center or global
4.5.2 Alert Rule Management
Create custom alert rules (if-then conditions)
Set alert recipients per rule
Assign alert priority (Critical, High, Medium, Low)
Set frequency caps and quiet hours
Enable/disable rules
4.5.3 User Management
Role-based access control (Admin, Manager, QA Lead, Center Director, Viewer)
Permission levels per feature
Mobile app provisioning
API key management for integrations
4.5.4 Integration Management
Slack workspace connection
SMS provider configuration (Twilio, etc.)
WhatsApp business account setup
Mobile push certificate management (APNs for iOS, FCM for Android)
Email provider settings



5. Data Model & Schema
5.1 Core Table: daily_deal_flow
Current schema includes:
id, submission_id, client_phone_number, lead_vendor, date
insured_name, buffer_agent, agent, licensed_agent_account
status, call_result, carrier, product_type
draft_date, monthly_premium, face_amount
policy_number, placement_status, carrier_audit
retention_agent, ghl_location_id, ghl_opportunity_id
Various flags: from_callback, is_callback, is_retention_call, sync_status


5.2 New Supporting Tables
centers (Master Data)
- id (UUID)
- center_name (text)
- location (text)
- manager_id (UUID, FK to users)
- region (text)
- daily_sales_target (numeric)
- status (active/inactive)
- created_at, updated_at
alert_rules (Alert Configuration)
- id (UUID)
- rule_name (text)
- trigger_type (low_sales, zero_sales, high_dq, low_approval, milestone)
- condition_threshold (numeric)
- alert_message_template (text)
- recipient_roles (text[])
- channels (text[] - slack, email, sms, push)
- priority (critical, high, medium, low)
- enabled (boolean)
- quiet_hours_start, quiet_hours_end (time)
- created_at, updated_at, created_by (UUID)
alerts_sent (Audit Trail)
- id (UUID)
- rule_id (UUID, FK)
- center_id (UUID, FK)
- alert_type (text)
- message (text)
- channels_sent (text[])
- recipients (text[])
- sent_at (timestamp)
- acknowledged_by (UUID)
- acknowledged_at (timestamp)
- response_action (text, optional)
- created_at
corrective_actions (QA/Compliance)
- id (UUID)
- dq_item_id (UUID, FK to dq_items)
- center_id (UUID, FK)
- assigned_to (UUID, FK to users)
- issue_description (text)
- status (assigned, in_progress, completed, verified)
- target_date (date)
- notes (text)
- created_at, updated_at, created_by (UUID)
dq_items (Quality Data)
- id (UUID)
- daily_deal_flow_id (UUID, FK)
- center_id (UUID, FK)
- agent_id (UUID, FK)
- dq_category (text)
- issue_description (text)
- severity (low, medium, high)
- created_at, discovered_date (date)
notification_preferences (User Settings)
- id (UUID)
- user_id (UUID, FK to users)
- alert_type (text)
- channels_enabled (text[])
- quiet_hours_start, quiet_hours_end (time)
- frequency_cap_minutes (integer)
- digest_mode (boolean)
- created_at, updated_at
mobile_devices (iOS/Android Registration)
- id (UUID)
- user_id (UUID, FK)
- device_token (text)
- device_type (iOS, Android)
- device_name (text)
- app_version (text)
- os_version (text)
- is_active (boolean)
- last_seen_at (timestamp)
- created_at, updated_at
5.3 Key Indexes
CREATE INDEX idx_daily_deal_flow_center_date 
  ON daily_deal_flow(center_id, date);
CREATE INDEX idx_daily_deal_flow_agent_date 
  ON daily_deal_flow(agent, date);
CREATE INDEX idx_alerts_sent_center_date 
  ON alerts_sent(center_id, sent_at);
CREATE INDEX idx_dq_items_center_date 
  ON dq_items(center_id, created_at);
CREATE INDEX idx_corrective_actions_status 
  ON corrective_actions(status, target_date);







6. Technical Architecture
6.1 System Components
Frontend (Web Dashboard)
Framework: React.js / Vue.js
Real-time updates: WebSocket or Server-Sent Events (SSE)
Charting: Chart.js, Recharts, or similar
Mobile-responsive design
Database
Supabase
Third-Party Integrations
Slack: Incoming Webhooks + Bot API
iOS Push: Apple Push Notification Service (APNs)
6.2 Data Flow
Data ingested into daily_deal_flow table
Real-time aggregation calculates metrics (sales, DQ%, approval ratio)
Alert engine evaluates metrics against rules
Matching alerts trigger notification dispatcher
Notifications sent to configured channels
Alert sent logged in alerts_sent table
Dashboard queries latest data from database + cache
Users see real-time updates via WebSocket
