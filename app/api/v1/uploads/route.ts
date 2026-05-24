import { NextRequest, NextResponse } from "next/server"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"

// Bucket configuration
const BUCKET_CONFIG = {
  "question-images": {
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    maxSizeLabel: "5 MB",
  },
  "event-logos": {
    maxSizeBytes: 2 * 1024 * 1024, // 2 MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/svg+xml"],
    maxSizeLabel: "2 MB",
  },
} as const

type BucketName = keyof typeof BUCKET_CONFIG

/**
 * POST /api/v1/uploads
 *
 * Validates the requested file type and size, then returns a Supabase Storage
 * signed upload URL so the client can upload directly to Storage.
 *
 * Request body (JSON):
 *   {
 *     bucket: "question-images" | "event-logos",
 *     filename: string,       // original filename, used to derive the storage path
 *     contentType: string,    // MIME type declared by the client
 *     contentLength: number,  // file size in bytes declared by the client
 *   }
 *
 * Response (201):
 *   {
 *     signedUrl: string,   // PUT URL for the client to upload to
 *     path: string,        // storage path (save this alongside the record)
 *     token: string,       // signed URL token (for constructing the public/signed URL later)
 *   }
 *
 * Requirements: 3.5, 3.6, 15.4, 15.5
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()

  // Use the authenticated (anon key) client to verify the admin session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore in Server Components
          }
        },
      },
    }
  )

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401 }
    )
  }

  // Parse request body
  let body: {
    bucket?: unknown
    filename?: unknown
    contentType?: unknown
    contentLength?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 }
    )
  }

  const { bucket, filename, contentType, contentLength } = body

  // Validate bucket
  if (!bucket || !Object.keys(BUCKET_CONFIG).includes(bucket as string)) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: `bucket must be one of: ${Object.keys(BUCKET_CONFIG).join(", ")}.`,
          field: "bucket",
        },
      },
      { status: 400 }
    )
  }
  const bucketName = bucket as BucketName
  const config = BUCKET_CONFIG[bucketName]

  // Validate filename
  if (!filename || typeof filename !== "string" || filename.trim().length === 0) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "filename is required.",
          field: "filename",
        },
      },
      { status: 400 }
    )
  }

  // Validate contentType (MIME type)
  if (!contentType || typeof contentType !== "string") {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "contentType is required.",
          field: "contentType",
        },
      },
      { status: 400 }
    )
  }

  if (!config.allowedMimeTypes.includes(contentType as never)) {
    return NextResponse.json(
      {
        error: {
          code: "UNSUPPORTED_FILE_TYPE",
          message: `File type "${contentType}" is not supported for ${bucketName}. Allowed types: ${config.allowedMimeTypes.join(", ")}.`,
          field: "contentType",
        },
      },
      { status: 415 }
    )
  }

  // Validate contentLength (file size)
  if (contentLength === undefined || contentLength === null) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "contentLength is required.",
          field: "contentLength",
        },
      },
      { status: 400 }
    )
  }

  if (typeof contentLength !== "number" || !Number.isFinite(contentLength) || contentLength < 0) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "contentLength must be a non-negative number.",
          field: "contentLength",
        },
      },
      { status: 400 }
    )
  }

  if (contentLength > config.maxSizeBytes) {
    return NextResponse.json(
      {
        error: {
          code: "FILE_TOO_LARGE",
          message: `File size exceeds the maximum allowed size of ${config.maxSizeLabel} for ${bucketName}.`,
          field: "contentLength",
        },
      },
      { status: 413 }
    )
  }

  // Build a unique storage path: {userId}/{timestamp}-{sanitisedFilename}
  const sanitisedFilename = (filename as string)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 200)
  const storagePath = `${user.id}/${Date.now()}-${sanitisedFilename}`

  // Use the service role client to create the signed upload URL
  // (the anon key does not have storage write permissions)
  const serviceClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // no-op for service role client
        },
      },
    }
  )

  const { data: uploadData, error: uploadError } = await serviceClient.storage
    .from(bucketName)
    .createSignedUploadUrl(storagePath)

  if (uploadError || !uploadData) {
    return NextResponse.json(
      {
        error: {
          code: "UPLOAD_URL_FAILED",
          message: "Failed to generate upload URL. Please try again.",
        },
      },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      signedUrl: uploadData.signedUrl,
      path: uploadData.path,
      token: uploadData.token,
    },
    { status: 201 }
  )
}
