import { workerConfig } from "@/uptime.config";
import { MonitorState } from "@/uptime.types";
import { NextRequest } from "next/server";

export const runtime = 'edge'

export default async function handler(request: NextRequest): Promise<Response> {
  const { UPTIMEFLARE_STATE } = process.env as unknown as {
    UPTIMEFLARE_STATE: KVNamespace
  }

  const stateStr = await UPTIMEFLARE_STATE?.get('state')
  if (!stateStr) {
    return new Response(JSON.stringify({ error: '暂无数据' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  const state = JSON.parse(stateStr) as MonitorState

  const monitors = workerConfig.monitors.map((monitor) => {
    const isUp = state.incident[monitor.id].slice(-1)[0].end !== undefined
    return {
      id: monitor.id,
      name: monitor.name,
      url: monitor.target,
      status: isUp ? 'up' : 'down',
      uptime: state.incident[monitor.id] && state.incident[monitor.id].length > 0
        ? (() => {
            const totalTime = Date.now() / 1000 - state.incident[monitor.id][0].start[0]
            let downTime = 0
            for (let incident of state.incident[monitor.id]) {
              downTime += (incident.end ?? Date.now() / 1000) - incident.start[0]
            }
            return (((totalTime - downTime) / totalTime) * 100).toFixed(2) + '%'
          })()
        : '100%',
      responseTime: state.latency[monitor.id]?.recent?.slice(-1)[0]?.ping || 0,
      message: isUp ? '正常' : state.incident[monitor.id].slice(-1)[0].error.slice(-1)[0]
    }
  })

  return new Response(JSON.stringify({
    overall: {
      up: state.overallUp,
      down: state.overallDown,
      status: state.overallDown === 0 ? 'operational' : state.overallUp === 0 ? 'outage' : 'degraded',
      lastUpdate: state.lastUpdate
    },
    monitors
  }), {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}
