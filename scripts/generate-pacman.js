#!/usr/bin/env node
import fs from 'fs'

const token = process.env.GITHUB_TOKEN
const user = process.env.USERNAME || process.env.GITHUB_REPOSITORY_OWNER || process.env.GITHUB_ACTOR

if (!token) {
  console.error('GITHUB_TOKEN not provided in environment; exiting')
  process.exit(1)
}

if (!user) {
  console.error('Username not determined from environment; set USERNAME or run in Actions');
  process.exit(1)
}

const query = `query($login:String!){ user(login:$login){ contributionsCollection{ contributionCalendar{ totalContributions weeks { contributionDays { date contributionCount color } } } } } }`;

async function fetchCalendar(login){
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'pacman-generator'
    },
    body: JSON.stringify({ query, variables: { login } })
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`GitHub GraphQL request failed: ${res.status} ${res.statusText} - ${t}`)
  }
  const j = await res.json()
  if (j.errors) throw new Error('GraphQL errors: ' + JSON.stringify(j.errors))
  return j.data.user.contributionsCollection.contributionCalendar
}

function mapColor(day){
  // if provider gives color, use it; otherwise map by count
  if (day && day.color) return day.color
  const c = day && day.contributionCount ? day.contributionCount : 0
  if (c <= 0) return '#0b1220'
  if (c === 1) return '#2f855a'
  if (c < 4) return '#38b2ac'
  return '#00e5ff'
}

function renderSVG(calendar){
  const weeks = calendar.weeks || []
  const cols = weeks.length || 53
  const rows = 7
  const cell = 10
  const pad = 6
  const width = pad*2 + cols * (cell + 3)
  const height = pad*2 + rows * (cell + 3) + 28

  let rects = ''
  for (let w = 0; w < cols; w++){
    const week = weeks[w]
    for (let d = 0; d < rows; d++){
      const day = week && week.contributionDays && week.contributionDays[d] ? week.contributionDays[d] : { contributionCount: 0 }
      const color = mapColor(day)
      const x = pad + w * (cell + 3)
      const y = pad + d * (cell + 3) + 20
      rects += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" ry="2" fill="${color}" />\n`
    }
  }

  const title = `<text x="${pad}" y="14" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#cbd5e1">Pacman contribution graph for ${user}</text>`

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n  <rect width="100%" height="100%" fill="#0b0f13"/>\n  ${title}\n  <g>\n  ${rects}  </g>\n</svg>`
}

async function main(){
  try{
    const calendar = await fetchCalendar(user)
    const svg = renderSVG(calendar)
    fs.mkdirSync('dist', { recursive: true })
    fs.writeFileSync('dist/pacman-contribution-graph.svg', svg)
    console.log('Wrote dist/pacman-contribution-graph.svg')
  }catch(err){
    console.error('Failed to generate graph:', err)
    process.exit(1)
  }
}

main()
