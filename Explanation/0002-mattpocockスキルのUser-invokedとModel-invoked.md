# mattpocockスキルの「User-invoked」と「Model-invoked」

## セッションごとに見える範囲が変わる

Claude Codeのセッション冒頭には「利用可能なスキル」の一覧が渡される。このプロジェクトで`mattpocock-skills`プラグインから渡されていたのは以下の9個だった。

```
diagnosing-bugs, tdd, prototype, research, domain-modeling,
codebase-design, code-review, resolving-merge-conflicts, grilling
```

ところが実際にインストールされているプラグイン本体（`~/.claude/plugins/marketplaces/mattpocock/`、バージョン1.2.0）の`skills/engineering/`配下には、これ以外にも`grill-with-docs`・`to-spec`・`to-tickets`・`implement`・`triage`・`wayfinder`・`ask-matt`・`setup-matt-pocock-skills`など、合計17個のengineeringスキルが存在する。差の8個は「消えている」のではなく、そもそも自動一覧に載らない設計になっている。

## 分類の根拠：`disable-model-invocation`

プラグイン内の`.agents/invocation.md`に、この分類がスキル作者（Matt Pocock）自身の言葉で定義されている。

> **User-invoked** — reachable only by the human typing its name. Set `disable-model-invocation: true` in the frontmatter... **Model-invoked** — reachable by model or user. The default: omit `disable-model-invocation`... The test for whether a skill should stay model-invoked: *could the model usefully reach for this autonomously?*

各スキルの`SKILL.md`のfrontmatterを機械的に見比べると、`disable-model-invocation: true`が付いているのは次のグループ。

| スキル | 役割 |
|---|---|
| `grill-with-docs` | 計画を尋問で固める（`/grilling`＋`/domain-modeling`を内部で呼ぶ） |
| `to-spec` | 会話をspec（PRD）にまとめてissue trackerに発行 |
| `to-tickets` | specや会話をvertical sliceのticket群に分割 |
| `implement` | ticket/specを実装（内部で`/tdd`→typecheck/test→`/code-review`→commitの順に進む） |
| `triage`, `wayfinder`, `ask-matt`, `setup-matt-pocock-skills` | 同様にユーザーが明示的に叩くオーケストレーション系 |

一方、`tdd`・`diagnosing-bugs`・`code-review`・`domain-modeling`など、今回のセッションで一覧に出ていたスキルにはこのフラグがない。つまり「タスクの説明文と合致すれば私（モデル）が自律的に選んでよい」スキルと、「人間が`/スキル名`と明示的にタイプしない限り絶対に呼ばれない」スキルが、同じプラグインの中に意図的に混在している。

理由は`invocation.md`にも書かれている通りで、User-invokedは複数のModel-invokedスキルをまたいで進行を制御する「オーケストレーション役」だから。もし全部Model-invokedにしてしまうと、モデルが会話の流れだけで`/to-tickets`（issueを大量発行する操作）のような重い操作を勝手に判断してしまいかねない。だから発行・実装開始のような後戻りしにくい操作は、常に人間が明示的にトリガーする設計にしてある。

## このプロジェクトでの具体例

`disable-model-invocation: true`が付いていても、スキル自体は削除されていないので`/grill-with-docs`・`/to-spec`・`/to-tickets`・`/implement`と直接タイプすれば今すぐ呼び出せる。実際、[Explanation/0003](0003-mattpocockスキルの正しい使い方.md)で確認した通り、このプロジェクトのissue #1は`/to-spec`が、issue #2〜#6は`/to-tickets`が発行したものだった（両スキルとも内部では`docs/agents/issue-tracker.md`の設定に従って`gh`コマンドでissueを作成している）。

このプロジェクトは既にissueが発行済みで「次に何を実装するか」が決まっているフェーズにあるため、パイプラインの前半（`grill-with-docs`→`to-spec`→`to-tickets`、ゼロから発想してissueを起こす工程）を使う出番がなく、後半の`implement`相当（`tdd`→`code-review`）だけが自動一覧に出ている、という状態になっている。
