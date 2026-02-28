<?php
declare(strict_types=1);

// Always return JSON for AJAX
header('Content-Type: application/json; charset=utf-8');

// ---- Config ----
// If you have api/config.php, we include it (optional).
// You told me config.php currently just echoes text — REMOVE that echo.
// config.php should NOT output anything.
$configPath = __DIR__ . '/config.php';
if (file_exists($configPath)) {
  require_once $configPath;
}

// Destination email (ONLY this)
$TO_EMAIL = defined('SGA_TO_EMAIL') ? SGA_TO_EMAIL : 'info@solidgroundarena.com';

// Basic guardrails
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'message' => 'Method not allowed.']);
  exit;
}

// Optional: simple anti-spam honeypot (add <input name="website" class="hidden"> in forms if you want)
if (!empty($_POST['website'] ?? '')) {
  http_response_code(200);
  echo json_encode(['ok' => true, 'message' => 'Submitted.']); // pretend success
  exit;
}

// ---- Helpers ----
function clean($v): string {
  if (is_array($v)) return '';
  $v = trim((string)$v);
  $v = str_replace(["\r", "\n"], ' ', $v); // prevent header injection
  return $v;
}

function respond(int $code, bool $ok, string $msg): void {
  http_response_code($code);
  echo json_encode(['ok' => $ok, 'message' => $msg]);
  exit;
}

// ---- Read meta fields ----
$subject = clean($_POST['_subject'] ?? 'Website Form Submission - Solid Ground Arena');
$submissionType = clean($_POST['submission_type'] ?? '');

// ---- Build message body from POST (exclude internal fields) ----
$lines = [];
$lines[] = "Solid Ground Arena - Form Submission";
$lines[] = "Submitted: " . date('Y-m-d H:i:s');
if ($submissionType !== '') $lines[] = "Type: " . $submissionType;
$lines[] = "----------------------------------------";

foreach ($_POST as $k => $v) {
  if ($k === '_subject' || $k === 'submission_type' || $k === 'website') continue;
  $key = clean($k);
  if (is_array($v)) {
    $val = implode(', ', array_map('clean', $v));
  } else {
    $val = clean($v);
  }
  if ($val === '') continue;
  $lines[] = "{$key}: {$val}";
}

$bodyText = implode("\n", $lines);

// Pick a reply-to if present
$replyTo = '';
foreach (['email', 'Email', 'applicant_email', 'contact_email'] as $emailKey) {
  if (!empty($_POST[$emailKey])) {
    $candidate = clean($_POST[$emailKey]);
    if (filter_var($candidate, FILTER_VALIDATE_EMAIL)) {
      $replyTo = $candidate;
      break;
    }
  }
}

// ---- Detect optional file upload (ANY field name) ----
$file = null;
foreach ($_FILES as $f) {
  if (
    is_array($f) &&
    isset($f['tmp_name']) &&
    is_uploaded_file($f['tmp_name']) &&
    ($f['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK
  ) {
    $file = $f;
    break;
  }
}

// If there is a file, validate it is PDF and size is reasonable
$attachmentPath = null;
$attachmentName = null;

if ($file) {
  $filename = $file['name'] ?? 'upload.pdf';
  $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

  if ($ext !== 'pdf') {
    respond(400, false, 'Only PDF files are allowed.');
  }

  $maxBytes = 12 * 1024 * 1024; // 12MB
  if (($file['size'] ?? 0) > $maxBytes) {
    respond(400, false, 'File too large (max 12MB).');
  }

  // Move to temp location (safer for reading)
  $tmpDir = sys_get_temp_dir();
  $safeName = preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($filename));
  $dest = rtrim($tmpDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . uniqid('sga_', true) . '_' . $safeName;

  if (!move_uploaded_file($file['tmp_name'], $dest)) {
    respond(500, false, 'Upload failed. Please try again.');
  }

  $attachmentPath = $dest;
  $attachmentName = $safeName;
}

// ---- Send mail (with or without attachment) ----
$fromEmail = 'no-reply@' . ($_SERVER['HTTP_HOST'] ?? 'solidgroundarena.com');
$fromName  = 'Solid Ground Arena Website';

$headers = [];
$headers[] = "From: {$fromName} <{$fromEmail}>";
$headers[] = "MIME-Version: 1.0";
if ($replyTo) $headers[] = "Reply-To: {$replyTo}";

$sent = false;

if ($attachmentPath) {
  $boundary = '==SGA_' . md5((string)microtime(true)) . '==';

  $headers[] = "Content-Type: multipart/mixed; boundary=\"{$boundary}\"";

  $message  = "--{$boundary}\r\n";
  $message .= "Content-Type: text/plain; charset=\"utf-8\"\r\n";
  $message .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
  $message .= $bodyText . "\r\n\r\n";

  $fileData = @file_get_contents($attachmentPath);
  if ($fileData === false) {
    @unlink($attachmentPath);
    respond(500, false, 'Could not read uploaded file.');
  }

  $message .= "--{$boundary}\r\n";
  $message .= "Content-Type: application/pdf; name=\"{$attachmentName}\"\r\n";
  $message .= "Content-Transfer-Encoding: base64\r\n";
  $message .= "Content-Disposition: attachment; filename=\"{$attachmentName}\"\r\n\r\n";
  $message .= chunk_split(base64_encode($fileData)) . "\r\n";
  $message .= "--{$boundary}--\r\n";

  $sent = @mail($TO_EMAIL, $subject, $message, implode("\r\n", $headers));
  @unlink($attachmentPath);
} else {
  $headers[] = "Content-Type: text/plain; charset=\"utf-8\"";
  $sent = @mail($TO_EMAIL, $subject, $bodyText, implode("\r\n", $headers));
}

if (!$sent) {
  respond(500, false, 'Mail failed to send. Please contact us directly.');
}

respond(200, true, 'Submitted! We’ll get back to you soon.');
