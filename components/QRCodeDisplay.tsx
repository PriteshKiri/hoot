"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"

interface QRCodeDisplayProps {
  /** The URL to encode in the QR code */
  url: string
  /** Size in pixels (default: 200) */
  size?: number
  /** Alt text for the image */
  alt?: string
}

/**
 * Client Component that generates a QR code data URL client-side using the
 * `qrcode` package and renders it as an <img> element.
 *
 * Requirements: 4.3, 4.4
 */
export function QRCodeDisplay({ url, size = 200, alt = "QR Code" }: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((result) => {
        if (!cancelled) setDataUrl(result)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
    }
  }, [url, size])

  if (error) {
    return (
      <div
        className="flex items-center justify-center bg-muted rounded-md text-muted-foreground text-sm"
        style={{ width: size, height: size }}
        role="img"
        aria-label="QR code generation failed"
      >
        QR code unavailable
      </div>
    )
  }

  if (!dataUrl) {
    return (
      <div
        className="flex items-center justify-center bg-muted rounded-md animate-pulse"
        style={{ width: size, height: size }}
        aria-label="Loading QR code"
        role="img"
      />
    )
  }

  return (
    <img
      src={dataUrl}
      alt={alt}
      width={size}
      height={size}
      className="rounded-md"
    />
  )
}
