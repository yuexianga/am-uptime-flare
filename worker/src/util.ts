async function getWorkerLocation() {
  const res = await fetch('https://cloudflare.com/cdn-cgi/trace')
  const text = await res.text()

  const colo = /^colo=(.*)$/m.exec(text)?.[1]
  return colo
}

const fetchTimeout = (
  url: string,
  ms: number,
  { signal, ...options }: RequestInit<RequestInitCfProperties> | undefined = {}
): Promise<Response> => {
  const controller = new AbortController()
  const promise = fetch(url, { signal: controller.signal, ...options })
  if (signal) signal.addEventListener('abort', () => controller.abort())
  const timeout = setTimeout(() => controller.abort(), ms)
  return promise.finally(() => clearTimeout(timeout))
}

function withTimeout<T>(millis: number, promise: Promise<T>): Promise<T> {
  const timeout = new Promise<T>((resolve, reject) =>
    setTimeout(() => reject(new Error(`Promise timed out after ${millis}ms`)), millis)
  )

  return Promise.race([promise, timeout])
}

function formatStatusChangeNotification(
  monitor: any,
  isUp: boolean,
  timeIncidentStart: number,
  timeNow: number,
  reason: string,
  timeZone: string
) {
  const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timeZone,
  })

  let downtimeDuration = Math.round((timeNow - timeIncidentStart) / 60);
  const timeNowFormatted = dateFormatter.format(new Date(timeNow * 1000))
  const timeIncidentStartFormatted = dateFormatter.format(new Date(timeIncidentStart * 1000))

  if (isUp) {
    return {
      title: `✅ ${monitor.name} 已恢复`,
      body: `服务已恢复，累计中断 ${downtimeDuration} 分钟。`,
    }
  } else if (timeNow == timeIncidentStart) {
    return {
      title: `🔴 ${monitor.name} 当前不可用`,
      body: `服务于 ${timeNowFormatted} 不可用。问题：${reason || '未说明'}`,
    }
  } else {
    return {
      title: `🔴 ${monitor.name} 仍然不可用`,
      body: `服务自 ${timeIncidentStartFormatted} 起不可用（已持续 ${downtimeDuration} 分钟）。问题：${reason || '未说明'}`,
    }
  }
}

async function notifyWithApprise(
  appriseApiServer: string,
  recipientUrl: string,
  title: string,
  body: string
) {
  console.log('Sending Apprise notification: ' + title + '-' + body + ' to ' + recipientUrl + ' via ' + appriseApiServer)
  try {
    const resp = await fetchTimeout(appriseApiServer, 5000, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls: recipientUrl,
        title,
        body,
        type: 'warning',
        format: 'text'
      }),
    })

    if (!resp.ok) {
      console.log('Error calling apprise server, code: ' + resp.status + ', response: ' + await resp.text())
    } else {
      console.log('Apprise notification sent successfully, code: ' + resp.status)
    }
  } catch (e) {
    console.log('Error calling apprise server: ' + e)
  }
}

export { getWorkerLocation, fetchTimeout, withTimeout, notifyWithApprise, formatStatusChangeNotification }
