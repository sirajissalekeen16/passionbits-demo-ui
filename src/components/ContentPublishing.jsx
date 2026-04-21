import { useState } from 'react'
import InstagramPanel from './InstagramPanel'
import TikTokPanel from './TikTokPanel'

export default function ContentPublishing({ email }) {
  const [platform, setPlatform] = useState('instagram')

  return (
    <div>
      <div className="platform-tabs">
        <button
          className={`platform-tab ${platform === 'instagram' ? 'active' : ''}`}
          onClick={() => setPlatform('instagram')}
        >
          Instagram
        </button>
        <button
          className={`platform-tab ${platform === 'tiktok' ? 'active' : ''}`}
          onClick={() => setPlatform('tiktok')}
        >
          TikTok
        </button>
      </div>

      {platform === 'instagram' && <InstagramPanel email={email} />}
      {platform === 'tiktok'    && <TikTokPanel email={email} />}
    </div>
  )
}
