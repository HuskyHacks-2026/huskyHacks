import {
  BarChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Spacer,
  Stack,
  Stat,
  Table,
  Text,
} from "cursor/canvas";

type Fit = "strong" | "partial" | "weak" | "risk";

type IdeaRow = {
  idea: string;
  challengeFit: number;
  beforeMoney: Fit;
  imposter: Fit;
  ato: Fit;
  recovery: Fit;
  notRebuild: Fit;
  personalDemo: Fit;
  friction: Fit;
  fraudsterLens: Fit;
  syntheticOk: Fit;
  note: string;
};

const IDEAS: IdeaRow[] = [
  {
    idea: "Hold Line",
    challengeFit: 92,
    beforeMoney: "strong",
    imposter: "strong",
    ato: "partial",
    recovery: "partial",
    notRebuild: "strong",
    personalDemo: "strong",
    friction: "strong",
    fraudsterLens: "strong",
    syntheticOk: "strong",
    note: "Names the lie at payment time; MFA still passes. Best match to Charlene's authorized-scam + friction dilemma.",
  },
  {
    idea: "Alias Vault + Continuity Desk (combined)",
    challengeFit: 78,
    beforeMoney: "partial",
    imposter: "partial",
    ato: "strong",
    recovery: "strong",
    notRebuild: "partial",
    personalDemo: "strong",
    friction: "partial",
    fraudsterLens: "strong",
    syntheticOk: "strong",
    note: "Strong ATO + rapid recovery story. Weaker on classic 'member pushes wire under coaching' unless Share Proxy/Speak Shield is Act 1.",
  },
  {
    idea: "Speak Shield (disclosure coach)",
    challengeFit: 74,
    beforeMoney: "strong",
    imposter: "strong",
    ato: "strong",
    recovery: "weak",
    notRebuild: "strong",
    personalDemo: "strong",
    friction: "partial",
    fraudsterLens: "strong",
    syntheticOk: "strong",
    note: "Intervenes when member is about to hand over codes/ACH — fits ATO path Charlene described. Overlaps Hold Line DNA.",
  },
  {
    idea: "Alias Vault alone (no master ACH)",
    challengeFit: 68,
    beforeMoney: "partial",
    imposter: "weak",
    ato: "strong",
    recovery: "partial",
    notRebuild: "risk",
    personalDemo: "partial",
    friction: "partial",
    fraudsterLens: "strong",
    syntheticOk: "strong",
    note: "Poisons leaked rails. Nancy risk: 'we already have treasury tools' unless framed as member-default UX, not inventing VANs.",
  },
  {
    idea: "Continuity Desk alone (Swap Kit + Credit Ledger)",
    challengeFit: 64,
    beforeMoney: "weak",
    imposter: "weak",
    ato: "partial",
    recovery: "strong",
    notRebuild: "strong",
    personalDemo: "strong",
    friction: "strong",
    fraudsterLens: "partial",
    syntheticOk: "strong",
    note: "Nails Charlene's 'lots of work to recover funds' and accountant pain. Soft on 'before the money moves' primary prompt.",
  },
  {
    idea: "ACH Positive Pay / Consent Gate",
    challengeFit: 52,
    beforeMoney: "strong",
    imposter: "weak",
    ato: "strong",
    recovery: "weak",
    notRebuild: "risk",
    personalDemo: "weak",
    friction: "risk",
    fraudsterLens: "partial",
    syntheticOk: "strong",
    note: "Real product category at CUs already. High 'don't rebuild what we have' risk from Nancy.",
  },
  {
    idea: "Counter Script (employee reset guard)",
    challengeFit: 58,
    beforeMoney: "partial",
    imposter: "weak",
    ato: "strong",
    recovery: "weak",
    notRebuild: "partial",
    personalDemo: "partial",
    friction: "partial",
    fraudsterLens: "strong",
    syntheticOk: "strong",
    note: "ATO via social-engineered resets. Overlaps Posh Protect/Simulator — Karan may see rival, not complement.",
  },
  {
    idea: "Inside Mule",
    challengeFit: 48,
    beforeMoney: "weak",
    imposter: "weak",
    ato: "partial",
    recovery: "partial",
    notRebuild: "partial",
    personalDemo: "partial",
    friction: "partial",
    fraudsterLens: "partial",
    syntheticOk: "strong",
    note: "Mostly after money moved; reads as AML dashboard. Weak on prompt's pre-loss intervention.",
  },
  {
    idea: "Fresh Shell / Payee Lock",
    challengeFit: 42,
    beforeMoney: "partial",
    imposter: "weak",
    ato: "partial",
    recovery: "weak",
    notRebuild: "risk",
    personalDemo: "weak",
    friction: "partial",
    fraudsterLens: "partial",
    syntheticOk: "strong",
    note: "Real problems, crowded vendor space. Easier for Nancy to say 'already exists.'",
  },
];

function fitPill(fit: Fit) {
  const tone =
    fit === "strong"
      ? "success"
      : fit === "partial"
        ? "info"
        : fit === "risk"
          ? "warning"
          : "neutral";
  const label =
    fit === "strong"
      ? "Strong"
      : fit === "partial"
        ? "Partial"
        : fit === "risk"
          ? "Rebuild risk"
          : "Weak";
  return <Pill tone={tone} size="sm">{label}</Pill>;
}

export default function WelcomeMeetingIdeaComparison() {
  const chartData = [...IDEAS]
    .sort((a, b) => b.challengeFit - a.challengeFit)
    .map((i) => ({
      label: i.idea.length > 28 ? i.idea.slice(0, 26) + "…" : i.idea,
      value: i.challengeFit,
    }));

  return (
    <Stack gap={24} style={{ padding: 24, maxWidth: 1100 }}>
      <Stack gap={8}>
        <H1>Welcome meeting → idea comparison</H1>
        <Text tone="secondary">
          Source: docs/welcome-meeting-transcript.md (HuskyHack 2026 opening,
          risk panel, challenge reveal) · Scored against live prompt + judge/risk
          advice · Not a survey of judges
        </Text>
      </Stack>

      <Callout tone="info" title="Official challenge (Part 4)">
        Stop the scam before the money moves. Recognize when a member is being
        manipulated, compromised, or deceived — and intervene before funds are
        lost. Address authorized/imposter scams, account takeover, or both.
        Surfaces: member, employee, or combined. Levers: prevention, real-time
        intervention, trusted contacts, employee escalation, and/or rapid
        recovery.
      </Callout>

      <Grid columns={4} gap={12}>
        <Stat value="Hold Line" label="Best challenge fit" tone="success" />
        <Stat value="92" label="Hold Line fit score (0–100)" tone="success" />
        <Stat value="78" label="Alias + Continuity combined" tone="info" />
        <Stat value="ATO+imp." label="Prompt allows either or both" />
      </Grid>

      <Stack gap={8}>
        <H2>Challenge-fit scores</H2>
        <Text tone="secondary" size="small">
          Weighted toward: before-money intervention, personal demo path,
          Charlene friction dilemma, Nancy “don’t rebuild,” synthetic-data
          constraints. Source: transcript scoring rubric below.
        </Text>
        <BarChart
          categories={chartData.map((d) => d.label)}
          series={[
            {
              name: "Challenge fit (0–100)",
              data: chartData.map((d) => d.value),
            },
          ]}
          height={280}
        />
      </Stack>

      <Divider />

      <Stack gap={8}>
        <H2>Transcript signals that matter</H2>
        <Grid columns={2} gap={12}>
          <Card>
            <CardHeader>Risk panel (Charlene / Dallas / Jen)</CardHeader>
            <CardBody>
              <Stack gap={6}>
                <Text size="small">
                  Two problem types: <Text weight="semibold">imposter/authorized</Text>{" "}
                  (member pushes the button; often member’s loss) and{" "}
                  <Text weight="semibold">account takeover</Text> (credentials
                  given; CU often eats loss if reported fast).
                </Text>
                <Text size="small">
                  Friction paradox: too little → “why didn’t you stop me?”; too
                  much → member anger when legitimate.
                </Text>
                <Text size="small">
                  MFA fails when members hand over codes; alerts get buried by
                  spam. Once cash/Bitcoin/crypto leaves, recovery is often gone.
                </Text>
                <Text size="small">
                  Advice: personal/loved-one story; simple or it gets buried;
                  think like fraudster and member.
                </Text>
              </Stack>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>Judges’ build advice</CardHeader>
            <CardBody>
              <Stack gap={6}>
                <Text size="small">
                  Nancy: personal story;{" "}
                  <Text weight="semibold">don’t rebuild what Sound already has</Text>
                  ; add-on for this gap; member would actually use it.
                </Text>
                <Text size="small">
                  Ryan: scale + interoperability (APIs/MCPs); one persona; don’t
                  boil the ocean.
                </Text>
                <Text size="small">
                  Dennis / Haluk / Sukhman: next-level / out-of-box / scalable —
                  not another generic tool.
                </Text>
                <Text size="small">
                  Karan: demo that clicks (don’t over-explain); ask questions;
                  aligned team; optional frontier = consumer agents + verifying
                  the agent.
                </Text>
                <Text size="small">
                  Turek: innovative ≠ complex; simple baseline is fine.
                </Text>
              </Stack>
            </CardBody>
          </Card>
        </Grid>
      </Stack>

      <Divider />

      <Stack gap={8}>
        <H2>Idea × transcript fit matrix</H2>
        <Text tone="secondary" size="small">
          Columns map to highest-signal takeaways from the transcript quick
          reference.
        </Text>
        <Table
          stickyHeader
          headers={[
            "Idea",
            "Fit",
            "Before $",
            "Imposter",
            "ATO",
            "Recovery",
            "Not rebuild",
            "Personal demo",
            "Friction OK",
            "Fraudster lens",
          ]}
          columnAlign={[
            "left",
            "right",
            "center",
            "center",
            "center",
            "center",
            "center",
            "center",
            "center",
            "center",
          ]}
          rows={IDEAS.map((i) => [
            i.idea,
            String(i.challengeFit),
            fitPill(i.beforeMoney),
            fitPill(i.imposter),
            fitPill(i.ato),
            fitPill(i.recovery),
            fitPill(i.notRebuild),
            fitPill(i.personalDemo),
            fitPill(i.friction),
            fitPill(i.fraudsterLens),
          ])}
        />
      </Stack>

      <Stack gap={8}>
        <H2>Notes by idea</H2>
        <Table
          headers={["Idea", "Transcript read"]}
          rows={IDEAS.map((i) => [i.idea, i.note])}
        />
      </Stack>

      <Divider />

      <Stack gap={12}>
        <H2>Deep compare: Hold Line vs Alias + Continuity</H2>
        <Grid columns={2} gap={12}>
          <Card variant="outlined">
            <CardHeader
              trailing={<Pill tone="success" size="sm">Fit 92</Pill>}
            >
              Hold Line
            </CardHeader>
            <CardBody>
              <Stack gap={8}>
                <H3>Why the transcript loves it</H3>
                <Text size="small">
                  Directly answers “stop before money moves” for authorized
                  scams — the volume Charlene said is huge and often member
                  loss. Same authenticated member, different decision; MFA
                  passes (Dallas: codes still get handed over). Quiet on
                  legitimate wires → Charlene friction paradox.
                </Text>
                <H3>Submission checklist coverage</H3>
                <Row gap={6} wrap>
                  <Pill size="sm" tone="success">
                    Member story
                  </Pill>
                  <Pill size="sm" tone="success">
                    Trigger
                  </Pill>
                  <Pill size="sm" tone="success">
                    False positive / allow
                  </Pill>
                  <Pill size="sm" tone="success">
                    Override / appeal
                  </Pill>
                  <Pill size="sm" tone="info">
                    Employee tags
                  </Pill>
                  <Pill size="sm" tone="info">
                    Recovery light
                  </Pill>
                </Row>
                <H3>Gaps vs transcript</H3>
                <Text size="small">
                  Recovery is callback/hold, not accountant remint or credit
                  tracking. ATO-via-stolen-ACH is secondary. Karan’s “consumer
                  agents” thread unused.
                </Text>
              </Stack>
            </CardBody>
          </Card>

          <Card variant="outlined">
            <CardHeader trailing={<Pill tone="info" size="sm">Fit 78</Pill>}>
              Alias Vault + Continuity Desk
            </CardHeader>
            <CardBody>
              <Stack gap={8}>
                <H3>Why the transcript likes parts of it</H3>
                <Text size="small">
                  ATO path: member gave up account info; canceling cards isn’t
                  enough (Dallas/Charlene + brother field note). Rapid recovery
                  + member support is an explicit judging lever and Charlene’s
                  “work to recover funds.” Personal story (Harbor Dental /
                  accountant) resonates with Nancy.
                </Text>
                <H3>Submission checklist coverage</H3>
                <Row gap={6} wrap>
                  <Pill size="sm" tone="success">
                    ATO journey
                  </Pill>
                  <Pill size="sm" tone="success">
                    Recovery
                  </Pill>
                  <Pill size="sm" tone="success">
                    Employee / ops desk
                  </Pill>
                  <Pill size="sm" tone="info">
                    Prevention (alias)
                  </Pill>
                  <Pill size="sm" tone="warning">
                    Imposter wire weak
                  </Pill>
                  <Pill size="sm" tone="warning">
                    Rebuild risk
                  </Pill>
                </Row>
                <H3>Gaps vs transcript</H3>
                <Text size="small">
                  Primary prompt emphasizes manipulation at the moment of
                  payment. Static-alias leak still hurts that rail (transcript
                  analogy). Nancy/Turek may ask “isn’t this positive pay /
                  VAN?” — must pitch composition + CU member UX, not invention
                  of rails. Weaker false-positive path unless allowlist UX is
                  demoed.
                </Text>
              </Stack>
            </CardBody>
          </Card>
        </Grid>
      </Stack>

      <Callout tone="success" title="Recommendation against this transcript">
        Lead with Hold Line for Phase 1 (best alignment to “before money moves”
        + imposter volume + friction paradox + demo that clicks). If the team
        splits: keep Alias Vault + Continuity Desk as the ATO/recovery companion
        — or fold Share Proxy into Hold Line Act 1 (“don’t paste master ACH;
        issue vendor alias”) so both axes serve one story. Do not pitch
        standalone Positive Pay / Fresh Shell / Payee Lock — high rebuild risk
        per Nancy.
      </Callout>

      <Stack gap={6}>
        <H2>Constraint check (starter kit)</H2>
        <Text size="small" tone="secondary">
          All scored ideas assumed synthetic scenarios only — no device intel,
          biometrics, carrier data, consortium feeds, or personal
          calls/texts/email/browser history (Part 4 guardrails). Hold Line and
          Alias+Continuity both run on scenario JSON + rules; that is a
          feasibility plus for Demirkan/Sternitzky inspectability.
        </Text>
      </Stack>

      <Spacer height={8} />
      <Text size="small" tone="secondary">
        HuskyHacks-2026 · comparison artifact for team planning · open beside
        chat or browse canvases/ in the repo
      </Text>
    </Stack>
  );
}
