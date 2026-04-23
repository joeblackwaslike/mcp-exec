#!/usr/bin/env bash
# Fake terminal session for VHS demo recording
# Act 1 — The pain
sleep 0.5
echo '$ claude "find overdue invoices and email sales team summary"'
sleep 1
echo ""
echo "  ✓ Connecting to QuickBooks MCP..."
sleep 0.6
echo "  ✓ Searching invoices... 847 records (context: +14,200 tokens)"
sleep 0.5
echo "  ✓ Fetching customer details... 23 matches (context: +8,100 tokens)"
sleep 0.5
echo "  ✓ Generating email draft..."
sleep 0.8
echo ""
echo "  ⚠  Claude AI Usage Limit Reached"
echo "     You've reached your usage limit and will be able"
echo "     to resume in 5 hours."
sleep 3

# Clear and Act 2 — The fix
clear
sleep 0.5
echo '$ claude "find overdue invoices and email sales team summary"'
sleep 0.8
echo ""
echo "  ✓ exec() — running in sandbox..."
sleep 1.5
echo ""
echo '  → "Draft created — 23 overdue invoices"'
echo ""
echo "  Tokens used: 80  (was: 22,300)"
sleep 2
