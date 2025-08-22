// ask.php — PHP 7.4+
// Responde siempre JSON { text: "...", [waiting:true, topic:"...", step:N] }

/*declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

// Silenciar notices para no romper el JSON
ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);

// === CONFIG ===
$OPENAI_API_KEY = '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'; // <-- Reemplaza por tu API key real
if (!$OPENAI_API_KEY) {
  http_response_code(500);
  echo json_encode(['error' => 'Missing OPENAI_API_KEY']); exit;
}
if (!extension_loaded('curl') || !extension_loaded('json')) {
  http_response_code(500);
  echo json_encode(['error' => 'PHP missing curl/json extensions']); exit;
}

// === HELPERS ===
function http_post_json(string $url, array $payload, string $apiKey): array {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
      'Content-Type: application/json',
      'Authorization: Bearer ' . $apiKey
    ],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_TIMEOUT => 30,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2
  ]);
  $resp = curl_exec($ch);
  $err  = curl_error($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  return [$code, $resp, $err];
}

function sanitize_output(string $txt): string {
  $bad = [
    '/\b(fuck|shit|bitch|asshole|bastard|cunt|dick|pussy|motherfucker)\b/i',
    '/\b(pendejo|pendeja|mierda|culero|cabron(es)?|put(a|o|os|as))\b/i'
  ];
  return preg_replace($bad, '****', $txt);
}

function moderate(string $apiKey, string $text): bool {
  if ($text === '') return false;
  [$code, $resp, $err] = http_post_json(
    'https://api.openai.com/v1/moderations',
    ['model' => 'omni-moderation-latest', 'input' => $text],
    $apiKey
  );
  if ($err || $code >= 400 || !$resp) return false;
  $data = json_decode($resp, true);
  return ($data['results'][0]['flagged'] ?? false) === true;
}

// === INPUT ===
$raw = file_get_contents('php://input');
$body = json_decode($raw ?: '{}', true);
$userText = trim((string)($body['userText'] ?? ''));

// Conversación continua (flujo tipo receta paso a paso)
$isContinue = !empty($body['continue']);
$topic = $body['topic'] ?? null;
$step = (int)($body['step'] ?? 0);
if ($isContinue && $topic === 'recipe') {
  $userText = "Continue step " . ($step + 1) . " of the pumpkin pie recipe.";
}

if ($userText === '') {
  http_response_code(400);
  echo json_encode(['error' => 'Missing userText']); exit;
}

// === Moderación de entrada ===
try {
  if (moderate($OPENAI_API_KEY, $userText)) {
    echo json_encode(['text' =>
      "Let’s keep it friendly 😊. I can help with recipes, spiciness, servings, or storage."
    ], JSON_UNESCAPED_UNICODE); exit;
  }
} catch (\Throwable $e) {}

// === SYSTEM PROMPT CONVERSACIONAL ===
$system = <<<EOT
You are Pack Genie, a friendly and helpful voice assistant for Libby's Pumpkin products.

## About the product:
- Ingredients: 100% pumpkin. No salt, sugar, preservatives or additives.
- Nutrition (½ cup): ~45 kcal, 0.5 g fat, 10 g carbs (3 g fiber), 1 g protein.
- Claims: Non-GMO, gluten-free, vegan, kosher, BPA-free can.
- Made from Dickinson pumpkins grown in the USA.
- Great for sweet and savory recipes like muffins, soups, cookies, and pies.
- Can substitute egg, butter or oil in baking.

## Behavior and style:
- Speak in a warm, upbeat, and approachable tone.
- Act like a friendly kitchen companion guiding users step by step.
- In recipes, never list all steps at once — break into small steps and wait for confirmation.
- Use transitions like: "Let’s begin with the ingredients…", "Ready for the next step?", "Now let’s get mixing!"
- Use natural, conversational flow with gentle check-ins.
- Avoid overloading the user — keep responses short and easy to follow.
- Never include emojis in responses.
- Never say inappropriate or offensive things. Censor or redirect gently.
- If the user is rude or offensive, respond kindly and steer back to pumpkin-related help.
- Keep all answers safe, family-friendly, and helpful.

Only answer questions related to Libby’s Pumpkin, recipes, usage, storage, and nutrition. If something is outside scope, reply: “I’m here to help with anything pumpkin-related — want a pie tip instead?”
EOT;

// === Llamada a OpenAI ===
[$code, $resp, $err] = http_post_json(
  'https://api.openai.com/v1/chat/completions',
  [
    'model' => 'gpt-4o-mini',
    'temperature' => 0.6,
    'messages' => [
      ['role' => 'system', 'content' => $system],
      ['role' => 'user',   'content' => $userText]
    ]
  ],
  $OPENAI_API_KEY
);

if ($err || $code >= 400 || !$resp) {
  echo json_encode(['text' =>
    "Sorry, I'm having trouble right now. Try a different question about pumpkin recipes, spiciness, servings, or storage."
  ], JSON_UNESCAPED_UNICODE); exit;
}

$data = json_decode($resp, true);
$text = trim((string)($data['choices'][0]['message']['content'] ?? ''));

// === Moderación de salida + sanitizado ===
if ($text === '' || $text === null) $text = "Sorry, I didn’t catch that.";
try {
  if (moderate($OPENAI_API_KEY, $text)) {
    $text = "I’ll keep it friendly. Want a safe pumpkin pie tip instead?";
  }
} catch (\Throwable $e) {}
$text = sanitize_output($text);

// === Detectar si respuesta espera continuar ===
$response = ['text' => $text];
if (preg_match('/(are you ready|ready to begin|shall we continue|say yes|when you\'re ready)/i', $text)) {
  $response['waiting'] = true;
  $response['topic'] = 'recipe';
  $response['step'] = $step + 1;
}

echo json_encode($response, JSON_UNESCAPED_UNICODE); exit;
*/