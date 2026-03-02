<?php
// tickets.php
declare(strict_types=1);

function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

$dataFile = __DIR__ . '/data/events.json';
$payload = @json_decode(@file_get_contents($dataFile), true);
$events = $payload["events"] ?? [];

$events = array_values(array_filter($events, fn($e) => ($e["active"] ?? false) === true));

// sort high->low then title
usort($events, function($a, $b) {
  $sa = (int)($a["sort"] ?? 0);
  $sb = (int)($b["sort"] ?? 0);
  if ($sa === $sb) return strcmp((string)($a["title"] ?? ''), (string)($b["title"] ?? ''));
  return $sb <=> $sa;
});

function renderCards(array $events, string $category): string {
  $cards = array_values(array_filter($events, fn($e) => ($e["category"] ?? '') === $category));
  if (count($cards) === 0) return '<p class="text-gray-600">No events listed yet.</p>';

  ob_start(); ?>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
    <?php foreach ($cards as $e): ?>
      <div class="bg-white rounded-3xl shadow-lg p-6 flex flex-col">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h4 class="font-bebas text-3xl leading-none"><?= h((string)($e["title"] ?? '')) ?></h4>
            <?php if (!empty($e["dates"])): ?>
              <p class="text-sm text-gray-600 mt-2"><?= h((string)$e["dates"]) ?></p>
            <?php endif; ?>
          </div>
        </div>

        <?php if (!empty($e["description"])): ?>
          <p class="mt-4 text-gray-600"><?= h((string)$e["description"]) ?></p>
        <?php endif; ?>

        <a
          href="<?= h((string)($e["url"] ?? '#')) ?>"
          target="_blank"
          rel="noopener"
          class="mt-6 inline-flex items-center justify-center bg-black text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-800 transition-colors"
        >
          <?= h((string)($e["buttonText"] ?? 'GET TICKETS')) ?>
        </a>
      </div>
    <?php endforeach; ?>
  </div>
  <?php
  return (string)ob_get_clean();
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tickets – Solid Ground Arena</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="/style.css" />
</head>
<body>

<!-- your site header/nav here -->

<section id="tickets" class="py-16 bg-gray-50">
  <div class="container mx-auto px-6">
    <div class="max-w-4xl">
      <h2 class="font-bebas text-4xl md:text-5xl mb-6">TICKETS</h2>

      <p class="text-lg text-gray-700 mb-4">
        Purchase tickets for upcoming events.
      </p>

      <p class="text-sm text-gray-700 mb-10">
        All ticket sales are final (no refunds after purchase unless the venue cancels the event).
      </p>
    </div>

    <h3 class="font-bebas text-3xl md:text-4xl mb-5">Upcoming Events</h3>
    <?= renderCards($events, "Upcoming Events"); ?>

    <div class="h-12"></div>

    <h3 class="font-bebas text-3xl md:text-4xl mb-5">Leagues & Camps</h3>
    <?= renderCards($events, "Leagues & Camps"); ?>

    <p class="text-xs text-gray-600 mt-10">
      Checkout and ticket delivery are powered by our secure ticketing partner.
    </p>
  </div>
</section>

<!-- your site footer here -->

</body>
</html>
