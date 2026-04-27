const BASE = '/api/v1'

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  return res.json()
}

// ── Meta OAuth ──────────────────────────────────────────────────────────────
export const metaOAuth = {
  status:     (email) => req('GET', `/meta-oauth/check-connection-status?email=${encodeURIComponent(email)}`),
  authorize:  (email) => req('POST', '/meta-oauth/authorize', { user_email: email }),
  disconnect: (email) => req('POST', '/meta-oauth/disconnect-account', { user_email: email }),
}

// ── Meta Ads ────────────────────────────────────────────────────────────────
export const metaAds = {
  listAccounts:   (email) => req('GET', `/meta-ads/ad-accounts?email=${encodeURIComponent(email)}`),
  ask:            (email, question, accountIds, datePreset) =>
    req('POST', '/meta-ads/ask', { user_email: email, question, account_ids: accountIds, date_preset: datePreset }),
  reportPdf:      (email, query, accountIds, datePreset) =>
    req('POST', '/meta-ads/report/markdown', { user_email: email, query, account_ids: accountIds, date_preset: datePreset }),
  reportHtml:     (email, query, accountIds, datePreset) =>
    req('POST', '/meta-ads/report/html', { user_email: email, query, account_ids: accountIds, date_preset: datePreset }),
  overallReport:  (email, accountIds, datePreset) =>
    req('POST', '/meta-ads/overall-report', { user_email: email, account_ids: accountIds, date_preset: datePreset }),
  listPdfReports: (email) => req('GET', `/meta-ads/reports/markdown?email=${encodeURIComponent(email)}`),
  listHtmlReports:(email) => req('GET', `/meta-ads/reports/html?email=${encodeURIComponent(email)}`),
  listOverall:    (email) => req('GET', `/meta-ads/overall-reports?email=${encodeURIComponent(email)}`),

  // Account KPIs + avg hook/hold/click/buy + daily graph
  accountSummary: (email, { accountId, datePreset = 'last_30d', minSpend = 0, includeGraph = true } = {}) => {
    const p = new URLSearchParams({ email, date_preset: datePreset, min_spend: String(minSpend), include_graph: String(includeGraph) })
    if (accountId) p.set('account_id', accountId)
    return req('GET', `/meta-ads/account/summary?${p.toString()}`)
  },

  // Per-ad table — sortable by any score / metric
  accountAds: (email, { accountId, sortBy = 'overall_score', order = 'desc', page = 1, pageSize = 20, minSpend = 0, includeRecent = true } = {}) => {
    const p = new URLSearchParams({
      email,
      sort_by: sortBy,
      order,
      page: String(page),
      page_size: String(pageSize),
      min_spend: String(minSpend),
      include_recent: String(includeRecent),
    })
    if (accountId) p.set('account_id', accountId)
    return req('GET', `/meta-ads/account/ads?${p.toString()}`)
  },
}

// ── Brand Mention Discovery ─────────────────────────────────────────────────
export const brandMentions = {
  run:         (email, jobId) => req('POST', '/creators/mentions/run', { email, ...(jobId ? { job_id: jobId } : {}) }),
  state:       (jobId) => req('GET', `/creators/mentions/state/${encodeURIComponent(jobId)}`),
  list:        (email, { page = 1, limit = 20, platform, sortBy = 'score', sortOrder = 'desc' } = {}) => {
    const p = new URLSearchParams({ email, page: String(page), limit: String(limit), sort_by: sortBy, sort_order: sortOrder })
    if (platform) p.set('platform', platform)
    return req('GET', `/creators/mentions?${p.toString()}`)
  },
  videos:      (email, { page = 1, limit = 50, platform, creatorId, sortBy = 'views', sortOrder = 'desc', uploadedWithin } = {}) => {
    const p = new URLSearchParams({ email, page: String(page), limit: String(limit), sort_by: sortBy, sort_order: sortOrder })
    if (platform) p.set('platform', platform)
    if (creatorId) p.set('creator_id', creatorId)
    if (uploadedWithin) p.set('uploaded_within', uploadedWithin)
    return req('GET', `/creators/mentions/videos?${p.toString()}`)
  },
  keywords:    (email) => req('GET', `/creators/mentions/keywords?email=${encodeURIComponent(email)}`),
  addKeywords: (email, keywords) => req('POST', '/creators/mentions/keywords', { email, keywords }),
  delKeywords: (email, keywords) => req('DELETE', '/creators/mentions/keywords', { email, keywords }),
  refresh:     (email) => req('POST', '/creators/mentions/refresh', { email }),
  searchWith:  (email, queries) => req('POST', '/creators/mentions/search-with-queries', { email, queries }),
}

// ── Instagram OAuth ──────────────────────────────────────────────────────────
export const igOAuth = {
  status:     (email) => req('GET', `/instagram-oauth/check-connection-status?email=${encodeURIComponent(email)}`),
  authorize:  (email) => req('POST', '/instagram-oauth/authorize', { user_email: email }),
  disconnect: (email) => req('POST', '/instagram-oauth/disconnect-account', { user_email: email }),
}

// ── TikTok OAuth ────────────────────────────────────────────────────────────
export const ttOAuth = {
  status:     (email) => req('GET', `/tiktok-oauth/check-connection-status?email=${encodeURIComponent(email)}`),
  authorize:  (email) => req('POST', '/tiktok-oauth/authorize', { user_email: email }),
  refresh:    (email) => req('POST', '/tiktok-oauth/refresh', { user_email: email }),
  disconnect: (email) => req('POST', '/tiktok-oauth/disconnect-account', { user_email: email }),
}

// ── B-Roll Templates ─────────────────────────────────────────────────────────
export const broll = {
  brandInfo: (name) => req('GET', `/broll-templates/brand-info?name=${encodeURIComponent(name)}`),
  uploadTemplate: (file, title = '', email = '', templateType = 'broll') => {
    const fd = new FormData()
    fd.append('video', file)
    if (title) fd.append('title', title)
    if (email) fd.append('uploaded_by', email)
    fd.append('template_type', templateType)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 180_000) // 3-min timeout (Gemini analysis)
    return fetch(BASE + '/broll-templates/upload', { method: 'POST', body: fd, signal: controller.signal })
      .then(r => r.json())
      .finally(() => clearTimeout(timer))
  },
  recommendMemeManual: (brandName, brandDescription, context = '', adStyleContext = '', brandIntelligence = {}) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 120_000)
    return fetch(BASE + '/broll-templates/recommend-meme-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_name: brandName, brand_description: brandDescription, context, ad_style_context: adStyleContext, brand_intelligence: brandIntelligence }),
      signal: controller.signal,
    })
      .then(r => r.json())
      .finally(() => clearTimeout(timer))
  },
  recommendManual: (brandName, brandDescription, context = '', adStyleContext = '', brandIntelligence = {}) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 120_000)
    return fetch(BASE + '/broll-templates/recommend-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_name: brandName, brand_description: brandDescription, context, ad_style_context: adStyleContext, brand_intelligence: brandIntelligence }),
      signal: controller.signal,
    })
      .then(r => r.json())
      .finally(() => clearTimeout(timer))
  },
  uploadProductVideo: (file) => {
    const fd = new FormData()
    fd.append('video', file)
    return fetch(BASE + '/broll-templates/upload-product-video', { method: 'POST', body: fd }).then(r => r.json())
  },
  getOutput: (templateId, caption, style = null, userEmail = '', musicId = null, musicStartSeconds = null, musicDurationSeconds = null, productVideoUrl = null) =>
    req('POST', '/broll-templates/get-output', {
      template_id: templateId,
      caption,
      ...(userEmail ? { user_email: userEmail } : {}),
      ...(style ? { style } : {}),
      ...(musicId ? { music_id: musicId } : {}),
      ...(musicStartSeconds != null && musicStartSeconds > 0 ? { music_start_seconds: musicStartSeconds } : {}),
      ...(musicDurationSeconds != null && musicDurationSeconds > 0 ? { music_duration_seconds: musicDurationSeconds } : {}),
      ...(productVideoUrl ? { product_video_url: productVideoUrl } : {}),
    }),
  outputStatus: (jobId) => req('GET', `/broll-templates/output-status/${jobId}`),
  captionOptions: () => req('GET', '/broll-templates/caption-options'),
  myTemplates: (email) =>
    req('GET', email ? `/broll-templates/my-templates?email=${encodeURIComponent(email)}` : '/broll-templates/my-templates'),
  recommendUserGivenManual: (brandName, brandDescription, context = '', adStyleContext = '', brandIntelligence = {}) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 120_000)
    return fetch(BASE + '/broll-templates/recommend-user-given-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_name: brandName, brand_description: brandDescription, context, ad_style_context: adStyleContext, brand_intelligence: brandIntelligence }),
      signal: controller.signal,
    })
      .then(r => r.json())
      .finally(() => clearTimeout(timer))
  },
  // ── Email-only (DB-backed) recommend endpoints ───────────────────────────
  recommendOriginal: (email, context = '', start = 1, end = 10) =>
    req('POST', '/broll-templates/recommend-original', { user_email: email, context, start, end }),
  recommendMemeOriginal: (email, context = '', start = 1, end = 10) =>
    req('POST', '/broll-templates/recommend-meme-original', { user_email: email, context, start, end }),
  recommendUserGivenOriginal: (email, context = '', start = 1, end = 10) =>
    req('POST', '/broll-templates/recommend-user-given-original', { user_email: email, context, start, end }),
  // ── v2: two-inference pipeline with live Pexels ingest ───────────────────
  recommendV2: (email, { brollType, productIds = [], context = '', count = 6, ignoreQueries = null } = {}) =>
    req('POST', '/broll-templates/recommend-v2', {
      user_email: email,
      broll_type: brollType,
      product_ids: productIds,
      context,
      count,
      ...(ignoreQueries != null ? { ignore_queries: ignoreQueries } : {}),
    }),
  brollTypes: () => req('GET', '/broll-templates/broll-types'),
  myBrandProducts: (email) => req('GET', `/broll-templates/my-brand-products?email=${encodeURIComponent(email)}`),
  // Persistent history — load on mount so the UI always shows prior work
  recommendationRuns: (email, { recommendType = null, offset = 0, limit = 20 } = {}) => {
    const p = new URLSearchParams({ user_email: email, offset: String(offset), limit: String(limit) })
    if (recommendType) p.set('recommend_type', recommendType)
    return req('GET', `/broll-templates/recommendation-runs?${p.toString()}`)
  },
  myGenerated: (email, { status = null, offset = 0, limit = 50 } = {}) => {
    const p = new URLSearchParams({ email, offset: String(offset), limit: String(limit) })
    if (status) p.set('status', status)
    return req('GET', `/broll-templates/my-generated?${p.toString()}`)
  },
}

// ── Music ────────────────────────────────────────────────────────────────────
export const music = {
  list: ({ mood, genre, email, source, limit = 100 } = {}) => {
    const p = new URLSearchParams({ limit })
    if (mood) p.set('mood', mood)
    if (genre) p.set('genre', genre)
    if (email) p.set('email', email)
    if (source) p.set('source', source)
    return req('GET', `/music?${p.toString()}`)
  },
  upload: (file, email, title = '', description = '', mood = '', genre = '') => {
    const fd = new FormData()
    fd.append('audio', file)
    fd.append('email', email)
    if (title) fd.append('title', title)
    if (description) fd.append('description', description)
    if (mood) fd.append('mood', mood)
    if (genre) fd.append('genre', genre)
    return fetch(BASE + '/music/upload', { method: 'POST', body: fd }).then(r => r.json())
  },
  byId: (id) => req('GET', `/music/${encodeURIComponent(id)}`),
}

// ── Slideshow ────────────────────────────────────────────────────────────────
export const slideshow = {
  generate: (brandName, brandDescription, context = '', n = 6, adStyleContext = '', brandIntelligence = {}) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 120_000)
    return fetch(BASE + '/slideshow/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_name: brandName, brand_description: brandDescription, context, n, ad_style_context: adStyleContext, brand_intelligence: brandIntelligence }),
      signal: controller.signal,
    })
      .then(r => r.json())
      .finally(() => clearTimeout(timer))
  },
  // Email-only (DB-backed) — returns {job_id}, result via socket slideshow_ready
  generateOriginal: (email, context = '', n = 6) =>
    req('POST', '/slideshow/generate-original', { user_email: email, context, n }),
  // Save edited style / position / texts back to DB
  patch: (id, email, slides, style, position) =>
    req('PATCH', `/slideshow/${id}`, { user_email: email, slides, style, position }),
  // List all saved slideshows for a user
  my: (email, limit = 20) =>
    req('GET', `/slideshow/my?user_email=${encodeURIComponent(email)}&limit=${limit}`),
  // Fetch a single slideshow (slides + style + position)
  get: (id, email) =>
    req('GET', `/slideshow/${id}?user_email=${encodeURIComponent(email)}`),
}

// ── Posting ──────────────────────────────────────────────────────────────────
export const posting = {
  uploadVideo: async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(BASE + '/automated-posts/upload-video', { method: 'POST', body: fd })
    return res.json()
  },
  postInstagram: (email, videoUrl, caption, coverUrl, scheduledAt) =>
    req('POST', '/automated-posts/post-instagram', {
      user_email: email,
      video_url: videoUrl,
      caption,
      cover_url: coverUrl || null,
      scheduled_at: scheduledAt || null,
    }),
  postTiktok: (email, videoUrl, caption, privacyLevel, opts, scheduledAt) =>
    req('POST', '/automated-posts/post-tiktok', {
      user_email: email,
      video_url: videoUrl,
      caption,
      privacy_level: privacyLevel || 'SELF_ONLY',
      scheduled_at: scheduledAt || null,
      ...opts,
    }),
}
