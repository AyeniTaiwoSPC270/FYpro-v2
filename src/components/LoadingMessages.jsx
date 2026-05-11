import { useState, useEffect, useRef } from 'react'

export default function LoadingMessages({ messages, className }) {
  const [index, setIndex] = useState(0)
  const [showLongWait, setShowLongWait] = useState(false)
  const messagesRef = useRef(messages)

  useEffect(() => {
    const msgs = messagesRef.current
    const rotateId = setInterval(() => {
      setIndex(prev => (prev + 1) % msgs.length)
    }, 3000)
    const longWaitId = setTimeout(() => setShowLongWait(true), 15000)
    return () => {
      clearInterval(rotateId)
      clearTimeout(longWaitId)
    }
  }, []) // runs once on mount; component unmounts when loading ends

  return (
    <div className={`fy-loading-messages${className ? ' ' + className : ''}`}>
      <p className="fy-loading-status">{messages[index]}</p>
      {showLongWait && (
        <p className="fy-loading-long-wait">
          Still working — Claude usually takes 15–30 seconds on first run. Don't close this page.
        </p>
      )}
    </div>
  )
}
