import { useApp } from '../../context/AppContext'

export default function ExpressBrief() {
  const { state } = useApp()
  const topic = state.validatedTopic || state.roughTopic || 'Your project'
  const methodology = state.chosenMethodology || ''
  const faculty = state.faculty || ''

  return (
    <div className="eb-brief">
      <div className="eb-brief__label">YOUR PROJECT</div>
      <p className="eb-brief__topic">{topic}</p>
      <div className="eb-brief__meta">
        {methodology && <span>{methodology}</span>}
        {methodology && faculty && <span>·</span>}
        {faculty && <span>{faculty}</span>}
      </div>
    </div>
  )
}
