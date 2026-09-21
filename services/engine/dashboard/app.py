"""
Vulpine Engine Dashboard — Streamlit admin interface.
Run: streamlit run dashboard/app.py
"""

import streamlit as st
import httpx
import pandas as pd
from datetime import datetime, timedelta

st.set_page_config(
    page_title="Vulpine Revenue Engine",
    page_icon="🦊",
    layout="wide",
)

API_BASE = "http://api:8000/api/v1"

# ── Sidebar ─────────────────────────────────────────────────

st.sidebar.title("🦊 Vulpine Engine")
st.sidebar.caption("Autonomous Cabinet Revenue Machine")

page = st.sidebar.radio(
    "Navigation",
    ["📊 Pipeline Overview", "📥 Import Leads", "🎯 Scoring", "📧 Outreach", "📬 Replies", "📞 Voice", "⚙️ Settings"],
)

st.sidebar.divider()
st.sidebar.metric("Server", "Online", delta=None)
st.sidebar.caption(f"Last refresh: {datetime.now().strftime('%H:%M:%S')}")

# ── Pipeline Overview ───────────────────────────────────────

if page == "📊 Pipeline Overview":
    st.title("Pipeline Overview")

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("BID NOW", "12", delta="+2 today")
    with col2:
        st.metric("HIGH PRIORITY", "34", delta="+5")
    with col3:
        st.metric("Bids Due (7d)", "8", delta="3 overdue")
    with col4:
        st.metric("Awaiting Reply", "17", delta="4 hot")

    st.divider()

    col_a, col_b = st.columns(2)

    with col_a:
        st.subheader("📋 Priority Actions")
        st.info("🔴 **4 replies need human attention** — including 2 plan requests")
        st.warning("🟡 **3 supplier RFQs awaiting response** — sent 4+ days ago")
        st.success("🟢 **2 verbal awards** pending contract")
        st.info("📅 **5 bids due this week**")

    with col_b:
        st.subheader("💵 Pipeline Value")
        st.bar_chart({
            "BID NOW": [2400000],
            "HIGH PRIORITY": [1800000],
            "DEVELOP": [950000],
            "MONITOR": [400000],
        })

    st.divider()
    st.subheader("Recent Activity")
    st.dataframe(
        pd.DataFrame([
            {"Time": "10:23 AM", "Event": "Reply received", "Detail": "Sent plans for Desert Ridge Apts", "Contact": "Mark Johnson"},
            {"Time": "9:45 AM", "Event": "Bid submitted", "Detail": "Park 25 Multifamily - $187,500", "Contact": "Sarah Chen"},
            {"Time": "8:30 AM", "Event": "New lead scored", "Detail": "BID NOW - GC with active hospitality project", "Contact": "Robert Mills"},
            {"Time": "7:15 AM", "Event": "Voice call completed", "Detail": "Interested - requesting capabilities deck", "Contact": "Lisa Park"},
            {"Time": "Yesterday", "Event": "PlanHub scan", "Detail": "3 new projects found in AZ region", "Contact": "—"},
        ]),
        use_container_width=True,
    )

# ── Import Leads ────────────────────────────────────────────

elif page == "📥 Import Leads":
    st.title("Import Leads")

    st.subheader("Upload CSV")
    uploaded_file = st.file_uploader("Choose a CSV file (Seamless, ZoomInfo, etc.)", type=["csv"])

    if uploaded_file:
        content = uploaded_file.read().decode("utf-8")
        st.text_area("Preview", content[:2000], height=200)

        col1, col2 = st.columns(2)
        with col1:
            if st.button("🚀 Import & Classify", type="primary"):
                st.info("Sending to engine...")
                # In production: async call to API
                st.success("✅ 247 leads imported, 182 new, 65 duplicates skipped")

    st.divider()
    st.subheader("Manual Lead Entry")
    with st.form("manual_lead"):
        c1, c2 = st.columns(2)
        with c1:
            first = st.text_input("First Name")
            email = st.text_input("Email")
            company = st.text_input("Company")
        with c2:
            last = st.text_input("Last Name")
            phone = st.text_input("Phone")
            title = st.text_input("Title")

        source = st.selectbox("Source", ["Seamless", "ZoomInfo", "PlanHub", "BuildingConnected", "Rep Submission", "Inbound", "Manual"])
        submitted = st.form_submit_button("Add Lead")

        if submitted:
            st.success(f"✅ {first} {last} added and queued for scoring")

# ── Scoring ─────────────────────────────────────────────────

elif page == "🎯 Scoring":
    st.title("Cabinet Opportunity Scoring")

    col1, col2 = st.columns(2)
    with col1:
        st.metric("Scored Contacts", "1,247")
    with col2:
        if st.button("🔄 Score All Unscored", type="primary"):
            st.info("Batch scoring started...")

    st.divider()
    st.subheader("Score Distribution")
    st.bar_chart({
        "BID NOW (90+)": [28],
        "HIGH PRIORITY (70-89)": [82],
        "DEVELOP (50-69)": [215],
        "MONITOR (30-49)": [418],
        "ARCHIVE (<30)": [504],
    })

    st.subheader("Scoring Criteria")
    st.json({
        "+25": "Active multifamily, hospitality, senior living, or student housing project",
        "+25": "Cabinets or casework explicitly listed in scope",
        "+15": "Direct estimator, PM, purchasing, or precon contact",
        "+10": "Bid date within 30 days",
        "+10": "Plans or cabinet schedules available",
        "+10": "Project value >$1M or 50+ units",
        "+15": "Existing relationship or rep introduction",
        "DQ": "Wrong industry, expired bid, no relevant scope",
    })

# ── Outreach ────────────────────────────────────────────────

elif page == "📧 Outreach":
    st.title("Outreach Engine")

    st.subheader("Quick Actions")
    c1, c2, c3 = st.columns(3)
    with c1:
        if st.button("📧 Email BID_NOW", type="primary"):
            st.success("Started outreach to 28 BID_NOW contacts")
    with c2:
        if st.button("📧 Email HIGH_PRIORITY"):
            st.success("Started outreach to 82 HIGH_PRIORITY contacts")
    with c3:
        if st.button("📞 Voice BID_NOW"):
            st.success("Launched voice campaign to 10 BID_NOW contacts")

    st.divider()
    st.subheader("Sequence Types")
    st.info("**Project-Specific**: We have a real project → confirm contact, request bid invite, request plans")
    st.info("**GC Account**: Known GC fits but no project → vendor onboarding, future bid lists")
    st.info("**Developer/Owner**: Become preferred supplier → pipeline discussion, value engineering")
    st.info("**Renovation**: Property managers, hospitality → unit-turn programs, portfolio pricing")

# ── Replies ─────────────────────────────────────────────────

elif page == "📬 Replies":
    st.title("Reply Inbox")

    st.subheader("Needs Attention")
    replies = [
        {"intent": "📎 Send Plans", "contact": "Mark Johnson", "company": "Desert Ridge GC", "summary": "Will send cabinet plans today. Who should I address?", "time": "10 min ago", "action": "Review & Download"},
        {"intent": "📞 Call Me", "contact": "Sarah Chen", "company": "Park 25 Development", "summary": "Call me tomorrow morning to discuss pricing.", "time": "1 hour ago", "action": "Schedule Call"},
        {"intent": "🔄 Redirected", "contact": "Robert Mills", "company": "Sun State Construction", "summary": "Contact Susan in estimating instead.", "time": "3 hours ago", "action": "Forward to Susan"},
        {"intent": "📋 Vendor Reg", "contact": "Lisa Park", "company": "Hilton Procurement", "summary": "Please complete our vendor registration first.", "time": "Yesterday", "action": "Complete Registration"},
    ]

    for r in replies:
        with st.expander(f"{r['intent']} | {r['contact']} — {r['company']} ({r['time']})"):
            st.write(f"**Summary**: {r['summary']}")
            st.button(f"✅ {r['action']}", key=r['contact'])

# ── Voice ───────────────────────────────────────────────────

elif page == "📞 Voice":
    st.title("Voice Outreach (Vapi)")

    st.metric("Calls Today", "0", delta="Max 10/day")

    st.subheader("Voice Agent Script")
    st.text_area("System Prompt (editable)", """You are an outreach specialist for Vulpine, a commercial cabinet supplier.
Name: Alex
Goal: Confirm cabinet procurement contact, identify active projects, get plans email.

Rules:
- Professional, direct, helpful
- Under 3 minutes
- ONE clear ask per call
- Never pressure""", height=300)

    if st.button("📞 Start Voice Campaign (BID_NOW)", type="primary"):
        st.info("Launching voice campaign to BID_NOW contacts...")

# ── Settings ────────────────────────────────────────────────

elif page == "⚙️ Settings":
    st.title("Engine Settings")

    st.subheader("GoHighLevel")
    st.text_input("GHL Location ID", value="z8he45H8AgqHO0hGHT5O", disabled=True)
    st.text_input("GHL API Base", value="https://services.leadconnectorhq.com", disabled=True)

    st.subheader("Scoring Thresholds")
    st.slider("BID NOW threshold", 80, 100, 90)
    st.slider("HIGH PRIORITY threshold", 60, 89, 70)
    st.slider("DEVELOP threshold", 40, 69, 50)

    st.subheader("Pricing Guardrails")
    st.number_input("Minimum gross margin %", value=18.0)
    st.number_input("Minimum commissionable profit", value=500.0)

    st.subheader("AI Models")
    st.selectbox("Reasoning Model", ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "gpt-4o"], index=0)
    st.selectbox("Writing Model", ["claude-sonnet-4-20250514", "gpt-4o"], index=0)
    st.selectbox("Cheap Model", ["gpt-4o-mini", "claude-haiku"], index=0)

    if st.button("💾 Save Settings"):
        st.success("Settings saved")

# ── Footer ──────────────────────────────────────────────────

st.divider()
st.caption("Vulpine Autonomous Cabinet Revenue Engine v0.1.0 | Built for Vulpine Cabinets")
