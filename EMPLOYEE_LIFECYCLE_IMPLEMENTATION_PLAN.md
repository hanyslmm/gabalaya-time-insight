# Employee Lifecycle System Implementation Plan

**Status**: In Progress  
**Date**: September 30, 2025  
**Goal**: Implement professional employee lifecycle management system (better than Homebase!)

---

## 🎯 VISION

Transform from simple delete system to professional employee lifecycle management:
- Keep complete employee history
- Support termination with reasons
- Enable rehiring
- Clean organization views
- System-wide employee database

---

## 📊 CURRENT VS PROPOSED ARCHITECTURE

### Current (Simple):
```
Employees Page
├── Show all employees (no filtering)
└── Delete → Permanently removes data ❌
```

### Proposed (Professional):
```
Employees Page (Organization-scoped)
├── Show only ACTIVE employees for current organization
├── Terminate → Sets status, keeps history ✅
└── Clean, focused view for managers

Employee Directory Page (System-wide)
├── All employees across ALL organizations
├── Filter by: Organization, Status, Date Range
├── View complete employment history
└── Rehire terminated employees
```

---

## 🗄️ DATABASE SCHEMA CHANGES

### Add to `employees` table:
```sql
-- New columns needed:
status VARCHAR DEFAULT 'active'  
  -- Values: 'active', 'terminated', 'on_leave', 'suspended'
  
termination_date DATE NULL
  -- Date when employee was terminated
  
termination_reason VARCHAR NULL
  -- From dropdown: Absenteeism, Admin Error, Business Conditions, etc.
  
eligible_for_rehire BOOLEAN DEFAULT true
  -- Can this employee be hired again?
  
notes TEXT NULL
  -- Additional termination notes
  
last_organization_id UUID NULL
  -- Track which org they were in when terminated
```

---

## 🎨 UI/UX COMPONENTS

### 1. Terminate Employee Dialog (Like Homebase)

**Fields
