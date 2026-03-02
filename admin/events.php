<?php
// Simple admin editor for /data/events.json
// v1: Basic HTTP auth recommended via cPanel "Directory Privacy" (preferred)
// This page assumes you protect /admin with a password.

declare(strict_types=1);

$dataFile = dirname(__DIR__) . '/data/events.json';

// ---------- helpers ----------
function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

function loadData(string $file): array {
  if (!file_exists($file)) return ["updatedAt" => gmdate('c'), "events" => []];
  $raw = file_get_contents($file);
  $json = json_decode($raw ?: '', true);
  if (!is_array($json) || !isset($json["events"]) || !is_array($json["events"])) {
    return ["updatedAt" => gmdate('c'), "events" => []];
  }
  return $json;
}

function saveData(string $file, array $data): void {
  $data["updatedAt"] = gmdate('c');
  $dir = dirname($file);
  if (!is_dir($dir)) mkdir($dir, 0755, true);

  $fp = fopen($file, 'c+');
  if (!$fp) throw new RuntimeException("Cannot open data file for writing.");

  // lock for safe writes
  if (!flock($fp, LOCK_EX)) { fclose($fp); throw new RuntimeException("Cannot lock data file."); }

  ftruncate($fp, 0);
  rewind($fp);
  fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
  fflush($fp);
  flock($fp, LOCK_UN);
  fclose($fp);
}

function slugify(string $s): string {
  $s = strtolower(trim($s));
  $s = preg_replace('/[^a-z0-9]+/', '-', $s);
  $s = trim($s ?? '', '-');
  return $s !== '' ? $s : 'event-' . bin2hex(random_bytes(3));
}

function normalizeBool($v): bool {
  return $v === '1' || $v === 1 || $v === true || $v === 'true' || $v === 'on';
}

// ---------- load ----------
$data = loadData($dataFile);
$events = $data["events"];

// ---------- actions ----------
$flash = '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $action = $_POST['action'] ?? '';

  try {
    if ($action === 'add' || $action === 'update') {
      $id = trim((string)($_POST['id'] ?? ''));
      $title = trim((string)($_POST['title'] ?? ''));
      $dates = trim((string)($_POST['dates'] ?? ''));
      $description = trim((string)($_POST['description'] ?? ''));
      $category = trim((string)($_POST['category'] ?? 'Upcoming Events'));
      $buttonText = trim((string)($_POST['buttonText'] ?? 'GET TICKETS'));
      $url = trim((string)($_POST['url'] ?? ''));
      $featured = normalizeBool($_POST['featured'] ?? false);
      $active = normalizeBool($_POST['active'] ?? true);
      $sort = (int)($_POST['sort'] ?? 0);

      if ($title === '') throw new RuntimeException("Title is required.");
      if ($url === '') throw new RuntimeException("TicketSpice URL is required.");
      if (!preg_match('#^https?://#i', $url)) throw new RuntimeException("URL must start with http:// or https://");

      if ($id === '') $id = slugify($title);

      $record = [
        "id" => $id,
        "title" => $title,
        "dates" => $dates,
        "description" => $description,
        "category" => $category,
        "buttonText" => $buttonText !== '' ? $buttonText : "GET TICKETS",
        "url" => $url,
        "featured" => $featured,
        "active" => $active,
        "sort" => $sort
      ];

      $found = false;
      foreach ($events as $i => $ev) {
        if (($ev["id"] ?? '') === $id) {
          $events[$i] = $record;
          $found = true;
          break;
        }
      }
      if (!$found) $events[] = $record;

      $data["events"] = $events;
      saveData($dataFile, $data);
      $flash = $found ? "Event updated." : "Event added.";
    }

    if ($action === 'delete') {
      $id = trim((string)($_POST['id'] ?? ''));
      $events = array_values(array_filter($events, fn($ev) => ($ev["id"] ?? '') !== $id));
      $data["events"] = $events;
      saveData($dataFile, $data);
      $flash = "Event deleted.";
    }

    // reload after changes
    $data = loadData($dataFile);
    $events = $data["events"];
  } catch (Throwable $t) {
    $error = $t->getMessage();
  }
}

// ---------- sort for display ----------
usort($events, function($a, $b) {
  $sa = (int)($a["sort"] ?? 0);
  $sb = (int)($b["sort"] ?? 0);
  if ($sa === $sb) return strcmp((string)($a["title"] ?? ''), (string)($b["title"] ?? ''));
  return $sb <=> $sa; // higher sort first
});

// determine edit target
$editId = $_GET['edit'] ?? '';
$editing = null;
if ($editId !== '') {
  foreach ($events as $ev) {
    if (($ev["id"] ?? '') === $editId) { $editing = $ev; break; }
  }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Events Admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
  <div class="max-w-6xl mx-auto p-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold">Events Admin</h1>
        <p class="text-gray-600 mt-1">Edits: <code class="bg-white px-2 py-1 rounded"><?= h($dataFile) ?></code></p>
      </div>
      <a class="text-sm underline text-gray-700" href="../tickets.php" target="_blank" rel="noopener">Open Tickets Page</a>
    </div>

    <?php if ($flash): ?>
      <div class="mt-4 bg-green-100 border border-green-200 text-green-900 rounded-xl p-4"><?= h($flash) ?></div>
    <?php endif; ?>
    <?php if ($error): ?>
      <div class="mt-4 bg-red-100 border border-red-200 text-red-900 rounded-xl p-4"><?= h($error) ?></div>
    <?php endif; ?>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
      <!-- FORM -->
      <div class="lg:col-span-1 bg-white rounded-2xl shadow p-5">
        <h2 class="text-xl font-semibold mb-3"><?= $editing ? 'Edit Event' : 'Add Event' ?></h2>

        <form method="post" class="space-y-3">
          <input type="hidden" name="action" value="<?= $editing ? 'update' : 'add' ?>"/>

          <div>
            <label class="text-sm font-semibold">ID (auto)</label>
            <input name="id" value="<?= h((string)($editing["id"] ?? '')) ?>"
                   class="mt-1 w-full rounded-xl border px-3 py-2"
                   placeholder="leave blank to auto-generate"/>
            <p class="text-xs text-gray-500 mt-1">Leave blank when adding; it will auto-create from title.</p>
          </div>

          <div>
            <label class="text-sm font-semibold">Title *</label>
            <input required name="title" value="<?= h((string)($editing["title"] ?? '')) ?>"
                   class="mt-1 w-full rounded-xl border px-3 py-2"
                   placeholder="e.g., St Patrick's Ironman Hockey Tournament"/>
          </div>

          <div>
            <label class="text-sm font-semibold">Dates</label>
            <input name="dates" value="<?= h((string)($editing["dates"] ?? '')) ?>"
                   class="mt-1 w-full rounded-xl border px-3 py-2"
                   placeholder="e.g., March 14 or March 21 · April 25 · May 30"/>
          </div>

          <div>
            <label class="text-sm font-semibold">Description</label>
            <textarea name="description" rows="3"
                      class="mt-1 w-full rounded-xl border px-3 py-2"
                      placeholder="Short 1-sentence description."><?= h((string)($editing["description"] ?? '')) ?></textarea>
          </div>

          <div>
            <label class="text-sm font-semibold">Category</label>
            <select name="category" class="mt-1 w-full rounded-xl border px-3 py-2">
              <?php
                $cats = ["Upcoming Events", "Leagues & Camps"];
                $current = (string)($editing["category"] ?? 'Upcoming Events');
                foreach ($cats as $c) {
                  $sel = ($c === $current) ? 'selected' : '';
                  echo "<option {$sel}>" . h($c) . "</option>";
                }
              ?>
            </select>
          </div>

          <div>
            <label class="text-sm font-semibold">TicketSpice URL *</label>
            <input required name="url" value="<?= h((string)($editing["url"] ?? '')) ?>"
                   class="mt-1 w-full rounded-xl border px-3 py-2"
                   placeholder="https://...ticketspice.com/your-page"/>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-sm font-semibold">Button Text</label>
              <input name="buttonText" value="<?= h((string)($editing["buttonText"] ?? 'GET TICKETS')) ?>"
                     class="mt-1 w-full rounded-xl border px-3 py-2"/>
            </div>
            <div>
              <label class="text-sm font-semibold">Sort (higher first)</label>
              <input name="sort" type="number" value="<?= h((string)($editing["sort"] ?? '0')) ?>"
                     class="mt-1 w-full rounded-xl border px-3 py-2"/>
            </div>
          </div>

          <div class="flex items-center gap-5 pt-2">
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" value="1" <?= (($editing["active"] ?? true) ? 'checked' : '') ?> />
              Active
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" name="featured" value="1" <?= (($editing["featured"] ?? false) ? 'checked' : '') ?> />
              Featured
            </label>
          </div>

          <button class="w-full mt-2 bg-black text-white font-bold rounded-xl py-3 hover:bg-gray-800">
            <?= $editing ? 'Save Changes' : 'Add Event' ?>
          </button>

          <?php if ($editing): ?>
            <a href="events.php" class="block text-center text-sm underline text-gray-600 mt-2">Cancel edit</a>
          <?php endif; ?>
        </form>

        <hr class="my-5"/>

        <form method="post" onsubmit="return confirm('Delete this event?');" class="space-y-2">
          <input type="hidden" name="action" value="delete"/>
          <label class="text-sm font-semibold">Delete by ID</label>
          <input name="id" class="w-full rounded-xl border px-3 py-2" placeholder="paste event id"/>
          <button class="w-full bg-red-600 text-white font-bold rounded-xl py-3 hover:bg-red-700">Delete</button>
        </form>
      </div>

      <!-- LIST -->
      <div class="lg:col-span-2">
        <div class="bg-white rounded-2xl shadow p-5">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold">Current Events</h2>
            <a class="text-sm underline text-gray-600" href="../data/events.json" target="_blank" rel="noopener">View JSON</a>
          </div>

          <div class="mt-4 overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="text-left text-gray-600 border-b">
                <tr>
                  <th class="py-2 pr-4">Title</th>
                  <th class="py-2 pr-4">Dates</th>
                  <th class="py-2 pr-4">Category</th>
                  <th class="py-2 pr-4">Active</th>
                  <th class="py-2 pr-4">Featured</th>
                  <th class="py-2 pr-4">Sort</th>
                  <th class="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <?php foreach ($events as $ev): ?>
                  <tr>
                    <td class="py-3 pr-4">
                      <div class="font-semibold"><?= h((string)($ev["title"] ?? '')) ?></div>
                      <div class="text-xs text-gray-500">id: <?= h((string)($ev["id"] ?? '')) ?></div>
                      <div class="text-xs">
                        <a class="underline text-gray-600" href="<?= h((string)($ev["url"] ?? '#')) ?>" target="_blank" rel="noopener">TicketSpice Link</a>
                      </div>
                    </td>
                    <td class="py-3 pr-4"><?= h((string)($ev["dates"] ?? '')) ?></td>
                    <td class="py-3 pr-4"><?= h((string)($ev["category"] ?? '')) ?></td>
                    <td class="py-3 pr-4"><?= (($ev["active"] ?? false) ? 'Yes' : 'No') ?></td>
                    <td class="py-3 pr-4"><?= (($ev["featured"] ?? false) ? 'Yes' : 'No') ?></td>
                    <td class="py-3 pr-4"><?= h((string)($ev["sort"] ?? 0)) ?></td>
                    <td class="py-3 pr-4">
                      <a class="underline" href="events.php?edit=<?= urlencode((string)($ev["id"] ?? '')) ?>">Edit</a>
                    </td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>

            <?php if (count($events) === 0): ?>
              <p class="text-gray-600 mt-4">No events yet.</p>
            <?php endif; ?>
          </div>
        </div>

        <p class="text-xs text-gray-500 mt-4">
          Tip: Protect <code>/admin</code> with cPanel “Directory Privacy” so only staff can access this page.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
