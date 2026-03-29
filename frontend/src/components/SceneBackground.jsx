export default function SceneBackground() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        background: '#0a0c1a',
      }}
    >
      <img
        src="/bg.jpg"
        alt=""
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          /* rotate portrait image to landscape */
          transform: 'translate(-50%, -50%) rotate(270deg)',
          /* scale so the rotated image covers the full viewport */
          width: '100vh',
          height: '100vw',
          objectFit: 'cover',
          objectPosition: 'center center',
        }}
      />
      {/* subtle dark veil so UI text remains readable */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(8,6,20,0.25) 0%, rgba(8,6,20,0.45) 100%)',
        }}
      />
    </div>
  )
}
