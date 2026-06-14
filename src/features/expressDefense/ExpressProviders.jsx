import { AppProvider } from '../../context/AppContext'
import ExpressProjectStateProvider from './ExpressProjectStateProvider'

// Mounts a second, isolated state stack for the Express app:
// - its own AppContext instance (separate storage key, isExpress=true)
// - its own ProjectState backed by the express project
export default function ExpressProviders({ children }) {
  return (
    <AppProvider storageKey="fypro_express_session" isExpress>
      <ExpressProjectStateProvider>
        {children}
      </ExpressProjectStateProvider>
    </AppProvider>
  )
}
