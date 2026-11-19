# GABAH Enterprise Theme — User Acceptance Test (UAT) Checklist

**Branch:** `feat/gabah-enterprise-theme-complete`
**Target:** `main`
**Date:** 2026-11-19
**Tester:** Business/IT owner (non-developer)
**Environment:** Manual review on the test instance (no live production data)

> For each item, record: **Expected result** | **Actual result** | **Pass/Fail**

---

## 1. Login

| # | Step | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| 1.1 | Open application → login page loads | Login form visible, GABAH branding correct | | |
| 1.2 | Submit valid credentials | Successful login, appropriate dashboard for role shown | | |
| 1.3 | Submit invalid credentials | Error shown, no login | | |
| 1.4 | Password field shows password (not visible) | | | |
| 1.5 | Login page responsive at 1366×768 | No horizontal overflow | | |

---

## 2. Dashboard

| # | Step | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| 2.1 | Dashboard for Admin GABAH | Clear title, KPI cards, recent activity | | |
| 2.2 | Dashboard for Karyawan | Role-appropriate widgets shown | | |
| 2.3 | Dashboard for GA | GA-only widgets; no IT-only widgets | | |
| 2.4 | Dashboard for IT | IT-only widgets; no GA-only widgets | | |
| 2.5 | KPI numbers come from API (not hardcoded) | Numbers update when data changes | | |
| 2.6 | Loading state visible | Skeleton/spinner shows while loading | | |
| 2.7 | Empty dashboard state visible | Message when no data | | |
| 2.8 | Dashboard viewport at 1440×900 | No clipping, readable | | |
| 2.9 | Dashboard viewport at 1280×720 | No horizontal overflow | | |

---

## 3. Sidebar Navigation

| # | Step | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| 3.1 | Sidebar visible on desktop | Logo, sections, menu items present | | |
| 3.2 | Active menu highlighted | Current page clearly indicated | | |
| 3.3 | Hover on menu item | Subtle background change, icon color change | | |
| 3.4 | Keyboard focus on menu item | Visible focus ring | | |
| 3.5 | Admin GABAH — Administration Control Panel visible | Yes | | |
| 3.6 | Karyawan — Administration panel not visible | Not shown | | |
| 3.7 | Sidebar no overflow | All sections visible without scrolling | | |
| 3.8 | Sidebar at tablet viewport | No horizontal overflow | | |
| 3.9 | Sidebar at mobile viewport (if applicable) | Stacked/layout works | | |

---

## 4. Header / Navbar

| # | Step | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| 4.1 | Header height consistent | h-16 (64px) | | |
| 4.2 | Brand logo visible and correct | GABAH logo | | |
| 4.3 | Search bar present (desktop) | Visible, functional | | |
| 4.4 | Notification badge shows count | Counts match data | | |
| 4.5 | Notification popover opens/closes | Works, no overflow | | |
| 4.6 | User profile menu visible | Shows name, role, department | | |
| 4.7 | Profile menu responsive at tablet | No overlap | | |
| 4.8 | No overlapping controls | Elements separated | | |
| 4.9 | No horizontal overflow in header | | | |

---

## 5. Asset Management

| # | Step | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| 5.1 | Asset catalog lists assets | Columns: No, Name, Category, Owner, Status | | |
| 5.2 | Table not clipped | All columns visible, wraps text | | |
| 5.3 | Pagination visible | Shows page numbers, works | | |
| 5.4 | Filter works | Filters by category, status, etc. | | |
| 5.5 | Add asset modal opens | Form complete | | |
| 5.6 | Edit asset works | Changes saved | | |
| 5.7 | Asset detail page readable | All fields visible | | |
| 5.8 | Action buttons (loan, report, QR) accessible | Works, no clipping | | |
| 5.9 | Empty state on asset list | Message shown | | |

---

## 6. Asset Detail

| # | Step | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| 6.1 | Asset detail shows all fields | Name, category, owner, location, loan, ticket | | |
| 6.2 | Borrowed assets show loan status | | | |
| 6.3 | Related tickets visible | | | |
| 6.4 | Modal not clipped | Scroll works | | |
| 6.5 | Save/close buttons visible | | | |

---

## 7. Asset Loan

| # | Step | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| 7.1 | Loan modal shows assets | No, Name, Category, Status | | |
| 7.2 | Loan form: start date, due date, borrower | Required fields marked | | |
| 7.3 | Submit loan | Success message, loan created | | |
| 7.4 | Validation error on invalid date | Message shown | | |
| 7.5 | Cancel button closes modal | | | |
| 7.6 | Loan success state | Message visible | | |

---

## 8. Meeting Room Reservation

| # | Step | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| 8.1 | Room list shows rooms | Name, status, capacity | | |
| 8.2 | Reservation form: room, date, time | Required fields marked | | |
| 8.3 | Submit reservation | Success message | | |
| 8.4 | Conflict detection | Error on overlapping reservation | | |
| 8.5 | Cancel reservation | Works | | |
| 8.6 | Room status update | After check-in/check-out | | |

---

## 9. Tickets

| # | Step | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| 9.1 | Ticket list shows tickets | No, Title, Category, Priority, Status | | |
| 9.2 | Create ticket modal | Form complete | | |
| 9.3 | Ticket detail page | All fields, status transitions | | |
| 9.4 | Status change works | Open → In Progress → Resolved | | |
| 9.5 | Invalid status transition blocked | Error message | | |
| 9.6 | Ticket search/filter | Works | | |

---

## 10. User Administration

| # | Step | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| 10.1 | Admin GABAH sees Users menu | Yes | | |
| 10.2 | Add user modal | Form complete | | |
| 10.3 | Edit user | Changes saved | | |
| 10.4 | Delete user | With confirmation | | |
| 10.5 | User list pagination | Works | | |

---

## 11. Role Administration

| # | Step | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| 11.1 | Admin GABAH sees Role/Location tabs | Yes | | |
| 11.2 | Role management page | Role list, add/edit | | |
| 11.3 | Location management page | Location list | | |
| 11.4 | Permission assignment | Role gets permissions | | |
| 11.5 | No modal clipping | Scroll works | | |

---

## 12. Location Administration

| # | Step | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| 12.1 | Location management page | HO, PIBC, RPC, Pangsub, kantor perawatan | | |
| 12.2 | Add location | Works | | |
| 12.3 | Edit location | Works | | |
| 12.4 | Location cards show correct info | Name, code, type, status | | |

---

## 13. All Administration Tabs

| # | Tab | Expected | Pass/Fail |
|---|---|---|---|
| 13.1 | Dashboard (Admin) | Module overview, read-only | |
| 13.2 | Users | List, add, edit, delete | |
| 13.3 | Roles | Role list, permissions | |
| 13.4 | Locations | Location list, add/edit | |
| 13.5 | Asset categories | Category list, add/edit | |
| 13.6 | Asset numbering | Rule catalog (read-only admin) | |
| 13.7 | Audit logs | Audit log list (read-only) | |
| 13.8 | System settings | Configuration (if applicable) | |
| 13.9 | All modals: width, scrolling, controls | No overflow, controls visible | |

---

## 14. Reports

| # | Step | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| 14.1 | Reports dashboard | KPI charts, tables | | |
| 14.2 | Charts render (if data exists) | No errors | | |
| 14.3 | Report table not clipped | | | |
| 14.4 | Empty report state | Message shown | | |

---

## 15. Forms and Modals (global review)

| # | Step | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| 15.1 | All forms: labels visible | Yes | | |
| 15.2 | All forms: required fields marked | Red asterisk + required | | |
| 15.3 | Form validation messages | Clear, near field | | |
| 15.4 | Form error state | Red border + message | | |
| 15.5 | Disabled/read-only fields | Not editable | | |
| 15.6 | Modal width and height | Fits viewport | | |
| 15.7 | Modal internal scrolling | Works for long content | | |
| 15.8 | Modal save/cancel buttons | Visible | | |
| 15.9 | Modal on mobile | Stacked/responsive | | |
| 15.10 | Form focus behavior | Focus ring visible | | |

---

## 16. Responsive Layout

| # | Viewport | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| 16.1 | 1366 × 768 laptop | No overflow, readable | | |
| 16.2 | 1440 × 900 desktop | No overflow, readable | | |
| 16.3 | 1280 × 720 laptop | No horizontal overflow | | |
| 16.4 | 1024 × 768 tablet | Stacked layout, no clipping | | |
| 16.5 | 768 × 1024 tablet (portrait) | Stacked layout | | |
| 16.6 | 375 × 667 mobile | Stacked, no horizontal scroll | | |
| 16.7 | Sidebar collapse at tablet | No overlap | | |
| 16.8 | Modal at tablet | Responsive, no overflow | | |
| 16.9 | Table at tablet | Horizontal scroll or stacked | | |
| 16.10 | No accidentally clipped content everywhere | | | |

---

## 17. Accessibility (manual checklist)

| # | Check | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| 17.1 | Tab through page | Logical order, no surprises | | |
| 17.2 | Focus indicator visible | 2px green-600 ring | | |
| 17.3 | All buttons have labels | No hidden buttons | | |
| 17.4 | Form inputs have labels | Visible labels | | |
| 17.5 | Contrast of text | 4.5:1 normal text | | |
| 17.6 | Contrast of icons | 3:1 | | |
| 17.7 | No color-only indicators | Icons/Text with semantic colors | | |
| 17.8 | Keyboard navigation works | All functions accessible | | |
| 17.9 | Modal focus trap | Tab stays in modal | | |
| 18.0 | Reduced motion respected | No animations | | |

---

## Summary

| Category | Pass | Fail | N/A |
|---|---|---|---|
| Login | ___ | ___ | ___ |
| Dashboard | ___ | ___ | ___ |
| Sidebar & Header | ___ | ___ | ___ |
| Asset Management | ___ | ___ | ___ |
| Asset Detail | ___ | ___ | ___ |
| Asset Loan | ___ | ___ | ___ |
| Meeting Room | ___ | ___ | ___ |
| Tickets | ___ | ___ | ___ |
| User Administration | ___ | ___ | ___ |
| Role Administration | ___ | ___ | ___ |
| Location Administration | ___ | ___ | ___ |
| Administration Tabs | ___ | ___ | ___ |
| Reports | ___ | ___ | ___ |
| Forms & Modals | ___ | ___ | ___ |
| Responsive Layout | ___ | ___ | ___ |
| Accessibility | ___ | ___ | ___ |

**Overall: ___ / ___ Pass**

**Bugs found:**  
1.  
2.  
3.  

**Notes:**
