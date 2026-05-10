# Multi-Project Dashboard + Project Reset Flow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-project dashboard with a multi-project cards view and wire the Project Reset (₦1,500) payment to unlock creating additional projects.

**Architecture:** Dashboard fetches all projects via `getAllUserProjects()`, renders a card per project plus a locked/unlocked "New Project" card. Clicking "Continue" touches `updated_at` so `loadUserState()` loads the right project when `/app` hydrates. Creating a new project archives all existing non-archived projects first.

**Tech Stack:** React, Supabase (anon key), Framer Motion, Paystack via `usePaystackCheckout`

---

### Task 1: supabase-client.ts — types + createProject status + helpers

**Files:**
- Modify: `src/lib/supabase-client.ts`

- [ ] Add `'active'` to the `Project.status` union and add `getAllUserProjects` + `archiveAllActiveProjects` exports:

```typescript
// Line ~35: change status union
status: 'draft' | 'active' | 'in_progress' | 'defense_ready' | 'archived'

// Line ~111: change createProject insert
status: 'active',   // was 'draft'

// New export after updateProject()
export async function getAllUserProjects(): Promise<Project[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) { console.error('[supabase-client] getAllUserProjects:', error.message); return [] }
  return (data as Project[]) ?? []
}

export async function archiveAllActiveProjects(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase
    .from('projects')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .neq('status', 'archived')
  if (error) console.error('[supabase-client] archiveAllActiveProjects:', error.message)
}
```

### Task 2: PaymentSuccess.jsx — handle project_reset tier

**Files:**
- Modify: `src/pages/PaymentSuccess.jsx`

- [ ] In the order summary rows array (around line 246), extend the ternary to handle `project_reset`:

```javascript
{ label: 'Plan',   value: tier === 'defense_pack' ? 'Defense Plan' : tier === 'project_reset' ? 'Project Reset' : 'Student Plan', type: 'white' },
{ label: 'Amount', value: tier === 'defense_pack' ? '₦3,500' : tier === 'project_reset' ? '₦1,500' : '₦2,000', type: 'white' },
```

### Task 3: Dashboard.jsx — multi-project cards grid

**Files:**
- Modify: `src/pages/Dashboard.jsx`

- [ ] Import new helpers at top of file (after existing imports):
```javascript
import { getAllUserProjects, createProject, archiveAllActiveProjects, updateProject } from '../lib/supabase-client'
```

- [ ] Add projects state + fetch inside `Dashboard()` component (after existing state declarations):
```javascript
const [projects, setProjects] = useState([])
const [projectsLoading, setProjectsLoading] = useState(true)

useEffect(() => {
  let cancelled = false
  getAllUserProjects().then(p => { if (!cancelled) { setProjects(p); setProjectsLoading(false) } })
  return () => { cancelled = true }
}, [])
```

- [ ] Add `handleContinueProject` and `handleStartNewProject` functions inside `Dashboard()`:
```javascript
async function handleContinueProject(projectId) {
  await updateProject(projectId, { status: 'active' })
  sessionStorage.setItem('intentional_app_entry', 'true')
  navigate('/app')
}

async function handleStartNewProject() {
  await archiveAllActiveProjects()
  const { data: { user } } = await supabase.auth.getUser()
  const newProject = await createProject({
    faculty: state.faculty || null,
    department: state.department || null,
    level: state.level || null,
  })
  if (!newProject) { showToastMessage('Failed to create project. Please try again.'); return }
  clearState()
  sessionStorage.setItem('intentional_app_entry', 'true')
  navigate('/app')
}
```

- [ ] Change the main content condition from `completedCount === 0` to use `projects`:
```javascript
// Replace:
//   {completedCount === 0 ? ( /* blank state */ ) : ( /* full dashboard */ )}
// With:
{projectsLoading ? (
  <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 120px)' }}>
    <div style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: '#0066FF', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
) : projects.length === 0 ? (
  /* existing blank welcome state — unchanged */
) : (
  /* new project cards grid */
  <ProjectsGrid
    projects={projects}
    features={features}
    onContinue={handleContinueProject}
    onStartNew={handleStartNewProject}
    onPay={() => handlePay('project_reset')}
  />
)}
```

- [ ] Add `ProjectsGrid`, `ProjectCard`, and `NewProjectCard` components above the `Dashboard` export (before the `export default function Dashboard()` line):

```javascript
function statusBadge(status) {
  if (status === 'active' || status === 'in_progress' || status === 'defense_ready')
    return { label: status === 'defense_ready' ? 'Defense Ready' : status === 'in_progress' ? 'In Progress' : 'Active', color: '#16A34A', bg: 'rgba(22,163,74,0.12)', border: 'rgba(22,163,74,0.25)' }
  if (status === 'archived')
    return { label: 'Archived', color: '#64748B', bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.22)' }
  return { label: 'Draft', color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.22)' }
}

function ProjectCard({ project, onContinue }) {
  const badge = statusBadge(project.status)
  const dateStr = new Date(project.created_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-input) 100%)',
        border: '1px solid var(--border-color)',
        borderRadius: 16,
        padding: '28px 28px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        transition: 'box-shadow 0.2s ease',
      }}
      whileHover={{ boxShadow: '0 8px 32px rgba(0,0,0,0.14)' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <h3 className="font-serif" style={{ fontSize: '1.05rem', color: 'var(--text-primary)', lineHeight: 1.3, flex: 1, margin: 0 }}>
          {project.title || 'Untitled Project'}
        </h3>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.04em',
          color: badge.color, background: badge.bg,
          border: `1px solid ${badge.border}`,
          borderRadius: 999, padding: '3px 10px', flexShrink: 0,
        }}>
          {badge.label}
        </span>
      </div>
      <p className="font-mono" style={{ fontSize: '0.71rem', color: 'var(--text-muted)', margin: 0 }}>
        Created {dateStr}
      </p>
      <motion.button
        whileHover={{ y: -1, boxShadow: '0 0 20px rgba(22,163,74,0.35)' }}
        whileTap={{ scale: 0.97 }}
        onClick={() => onContinue(project.id)}
        style={{
          alignSelf: 'flex-start',
          background: '#16A34A', color: '#fff',
          border: 'none', borderRadius: 10,
          padding: '9px 20px',
          fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '0.82rem',
          cursor: 'pointer', transition: 'background 0.15s ease',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        Continue <ArrowRightIcon size={13} />
      </motion.button>
    </motion.div>
  )
}

function NewProjectCard({ features, onStartNew, onPay }) {
  const hasProjectReset = Array.isArray(features) &&
    (features.includes('project_reset') || features.includes('defense_pack'))
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
      onClick={hasProjectReset ? undefined : onPay}
      style={{
        background: hasProjectReset
          ? 'linear-gradient(145deg, rgba(22,163,74,0.06) 0%, rgba(22,163,74,0.02) 100%)'
          : 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-input) 100%)',
        border: hasProjectReset ? '1.5px dashed rgba(22,163,74,0.4)' : '1.5px dashed var(--border-color)',
        borderRadius: 16,
        padding: '28px 28px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        minHeight: 160,
        cursor: hasProjectReset ? 'default' : 'pointer',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
      whileHover={!hasProjectReset ? { boxShadow: '0 4px 20px rgba(0,0,0,0.1)' } : {}}
    >
      {hasProjectReset ? (
        <>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PlusIcon />
          </div>
          <p className="font-sans" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            New Project
          </p>
          <motion.button
            whileHover={{ y: -1, boxShadow: '0 0 20px rgba(22,163,74,0.35)' }}
            whileTap={{ scale: 0.97 }}
            onClick={onStartNew}
            style={{
              background: '#16A34A', color: '#fff',
              border: 'none', borderRadius: 10,
              padding: '9px 20px',
              fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '0.82rem',
              cursor: 'pointer', transition: 'background 0.15s ease',
            }}
          >
            Start New Project
          </motion.button>
        </>
      ) : (
        <>
          <LockIcon size={20} />
          <p className="font-sans" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            New Project
          </p>
          <p className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
            ₦1,500 to unlock
          </p>
        </>
      )}
    </motion.div>
  )
}

function ProjectsGrid({ projects, features, onContinue, onStartNew, onPay }) {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 className="font-serif" style={{ fontSize: '1.6rem', color: 'var(--text-primary)', margin: '0 0 6px' }}>
          My Projects
        </h1>
        <p className="font-sans" style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
          {projects.length} project{projects.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        {projects.map(p => (
          <ProjectCard key={p.id} project={p} onContinue={onContinue} />
        ))}
        <NewProjectCard features={features} onStartNew={onStartNew} onPay={onPay} />
      </div>
    </div>
  )
}
```
