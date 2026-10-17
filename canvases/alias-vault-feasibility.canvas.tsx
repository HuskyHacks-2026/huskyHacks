import {
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
  Stack,
  Stat,
  Table,
  Text,
} from "cursor/canvas";

export default function AliasVaultFeasibility() {
  return (
    <Stack gap={24} style={{ padding: 24, maxWidth: 1100 }}>
      <Stack gap={8}>
        <H1>Alias Vault — expanded model & feasibility</H1>
        <Text tone="secondary">
          Transcript analogy (official vs unofficial) · temporary CU-brokered
          aliases · collision/binding · prior art · welcome-meeting fit · devil’s
          advocate
        </Text>
      </Stack>

      <Grid columns={4} gap={12}>
        <Stat value="Feasible" label="As vault + VAN/token" tone="success" />
        <Stat value="Partial" label="Vs challenge prompt" tone="warning" />
        <Stat value="Prior art" label="UPIC / TCH / Apple Pay story" tone="info" />
        <Stat value="ATO+" label="Best problem slice" tone="success" />
      </Grid>

      <Callout tone="info" title="Core product rule">
        Official credentials live only at the credit union (official transcript).
        Members see an unofficial view (balances, last4, history) that cannot
        authorize ACH. Paying means: member requests → CU validates context → CU
        releases a bound, time-limited alias to the counterparty — never the
        master DDA.
      </Callout>

      <Divider />

      <Stack gap={8}>
        <H2>How binding kills the collision fear</H2>
        <Text>
          The alias digits do <Text weight="semibold">not</Text> encode the
          master account. They are an opaque key into a CU vault row. ACH only
          ever sees ABA + account-shaped digits; the CU (or network token
          service) looks up the live mapping.
        </Text>
        <Table
          headers={["Field", "Role"]}
          rows={[
            [
              "alias_id (digits on the wire)",
              "Opaque handle under a dedicated token RTN or CU routing number",
            ],
            [
              "master_account_id",
              "Internal Symitar/core pointer — never shared",
            ],
            [
              "vendor_scope",
              "Company ID / merchant / one-time payee binding",
            ],
            [
              "ttl / max_uses / amount_cap",
              "Policy: expire, single-use, or standing-with-kill-switch",
            ],
            [
              "status",
              "active | expired | revoked | settled — lookup fails unless active + rules match",
            ],
          ]}
        />
        <Callout tone="success" title="Reuse after expiry">
          After status=expired and the ACH return window is closed, the same
          digit string can be reassigned to a new vault row for a different
          master. A thief holding yesterday’s alias hits a dead or wrong-policy
          mapping — not “any account it was ever associated with.” Correctness
          is table integrity + issuance locks, not magic in the digit string.
        </Callout>
        <Text size="small" tone="secondary">
          Scale: Sound-sized (~185k members) minting many aliases/day is a
          normal allocation problem (integer pool + DB unique constraint +
          dedicated RTN). Card networks and TCH token services already do this
          at larger scale.
        </Text>
      </Stack>

      <Divider />

      <Stack gap={8}>
        <H2>Automated “request” flow (not a human registrar)</H2>
        <Table
          headers={["Step", "Who", "What"]}
          rows={[
            [
              "1. Intent",
              "Member",
              "Tap Pay / Share with vendor / Enroll biller in CU app",
            ],
            [
              "2. Broker",
              "CU Alias Vault",
              "Authn member session; build policy (amount, TTL, payee)",
            ],
            [
              "3. Trust check",
              "CU policy",
              "Known biller allowlist, new-payee cool-down, employee escalate — not omniscient KYC of every LLC",
            ],
            [
              "4. Mint",
              "Vault",
              "Create vault row; return alias digits (or push token to merchant processor)",
            ],
            [
              "5. Present",
              "Vendor / wallet",
              "Receives alias only — member never copies master",
            ],
            [
              "6. Clear",
              "ACH/RTP/card",
              "Presentment → detokenize/lookup → post to master if active",
            ],
            [
              "7. Expire/revoke",
              "Vault",
              "TTL, single-use, or member/employee kill switch",
            ],
          ]}
        />
      </Stack>

      <Divider />

      <Stack gap={8}>
        <H2>Closest existing architectures</H2>
        <Table
          headers={["Pattern", "What it is", "Vs your idea"]}
          rows={[
            [
              "Apple Pay DPAN / MPAN",
              "Device/merchant tokens; cryptogram per tap; PAN never shared",
              "Same custody story on card rails. ACH does not get per-tap cryptograms the same way.",
            ],
            [
              "TCH Token Service / Visa PAT",
              "Account tokens on ACH/RTP; rules (channel, merchant, use count); reissue without new account",
              "Strongest ACH prior art for temporary/bound aliases.",
            ],
            [
              "UPIC",
              "Publishable ACH credit-only mask of DDA",
              "Older, static, credit-focused — your “unofficial can’t pay” cousin.",
            ],
            [
              "Virtual account numbers",
              "Per-payee/per-invoice aliases under one master",
              "Standing VAN ≈ long-lived alias; kill switch without closing checking.",
            ],
            [
              "ACH positive pay / debit filter",
              "Allowlist Company IDs; return unknowns",
              "Complements vault: even leaked alias fails if originator unbound.",
            ],
          ]}
        />
        <Text size="small" tone="secondary">
          Feasibility verdict: the vault + bound alias model is production-proven
          on cards and increasingly on ACH tokens. What is not proven as
          “tap-to-pay ACH cryptogram” is short TTL theater on batch ACH — pitch
          carefully.
        </Text>
      </Stack>

      <Divider />

      <Stack gap={8}>
        <H2>Welcome meeting fit</H2>
        <Grid columns={2} gap={12}>
          <Card>
            <CardHeader>Aligns</CardHeader>
            <CardBody>
              <Stack gap={6}>
                <Text size="small">
                  Account takeover: Charlene — member gives up account info;
                  MFA codes still handed over. If master never circulates,
                  harvested digits are aliases with TTL/scope.
                </Text>
                <Text size="small">
                  Dallas: after bad actor is in — kill aliases / revoke vault
                  bindings without closing the real account.
                </Text>
                <Text size="small">
                  Recovery/support criterion: remint aliases + Continuity Desk
                  after compromise.
                </Text>
                <Text size="small">
                  Nancy personal story: “my account numbers can’t be read to a
                  scammer because I don’t have them.”
                </Text>
              </Stack>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>Misses / tension</CardHeader>
            <CardBody>
              <Stack gap={6}>
                <Text size="small">
                  Core prompt: stop scam before money moves when member is
                  manipulated. Coached Approve still mints an alias to the mule.
                </Text>
                <Text size="small">
                  Charlene friction paradox: trust checks add steps; romance /
                  urgency scams demand speed.
                </Text>
                <Text size="small">
                  Bitcoin ATM / cash / Zelle / wire stories — no ACH alias
                  involved.
                </Text>
                <Text size="small">
                  Nancy don’t-rebuild: name UPIC/VAN/TCH tokens; claim CU
                  member UX + brokered release, not invention of tokens.
                </Text>
              </Stack>
            </CardBody>
          </Card>
        </Grid>
      </Stack>

      <Divider />

      <Stack gap={8}>
        <H2>Devil’s advocate — ranked holes</H2>
        <Text tone="secondary" size="small">
          From adversarial review pass on this refined model.
        </Text>
        <Table
          headers={["#", "Hole", "Why it hurts"]}
          rows={[
            [
              "1",
              "Authorized/imposter scams",
              "Member taps Approve for the scammer — vault still sends money path",
            ],
            [
              "2",
              "ACH ≠ card cryptogram",
              "Batch settlement; TTL doesn’t unwind an accepted ACH entry",
            ],
            [
              "3",
              "Standing payees",
              "Payroll/utilities want static numbers — forces long-lived VANs",
            ],
            [
              "4",
              "Vendor trust oracle",
              "CU cannot perfectly know every LLC; SE targets the check itself",
            ],
            [
              "5",
              "Prior art optics",
              "Judges map you to UPIC/VAN/Apple Pay unless wedge is sharp",
            ],
            [
              "6",
              "Live alias theft",
              "During TTL, alias is a working credential for that binding",
            ],
            [
              "7",
              "Session ATO",
              "Thief with the banking session is the authorizer",
            ],
            [
              "8",
              "Production core",
              "Symitar + ODFI + returns ops ≠ weekend mock vault alone",
            ],
          ]}
        />
      </Stack>

      <Callout tone="warning" title="Honest pitch boundary">
        Alias Vault is a strong answer to “stolen/shared ACH digits burn the
        whole account.” It is a weak solo answer to “coached member authorizes
        the loss.” Pair with a Hold Line–style deception check on new payee /
        urgency language, or explicitly claim the ATO + credential-hygiene
        slice of the dual prompt.
      </Callout>

      <Stack gap={8}>
        <H2>Two-tier aliases (makes “temporary” + “bills” coexist)</H2>
        <Grid columns={2} gap={12}>
          <Card variant="outlined">
            <CardHeader trailing={<Pill tone="info" size="sm">Ephemeral</Pill>}>
              One-time / short TTL
            </CardHeader>
            <CardBody>
              <Text size="small">
                Checkout, new vendor, “share once.” Max uses = 1, TTL minutes–
                hours, amount-capped. Closest to tap semantics; best leak story.
              </Text>
            </CardBody>
          </Card>
          <Card variant="outlined">
            <CardHeader
              trailing={<Pill tone="success" size="sm">Standing + kill</Pill>}
            >
              Biller VAN
            </CardHeader>
            <CardBody>
              <Text size="small">
                Payroll, rent, utilities. Long-lived but revocable without
                closing master. Leak → revoke that VAN only; remint Continuity
                Desk style.
              </Text>
            </CardBody>
          </Card>
        </Grid>
      </Stack>

      <Stack gap={8}>
        <H2>Weekend feasibility (what you can prove)</H2>
        <Row gap={8} wrap>
          <Pill tone="success">Mock vault DB + mint/revoke</Pill>
          <Pill tone="success">Member never sees master</Pill>
          <Pill tone="success">Expired alias rejected</Pill>
          <Pill tone="success">Wrong vendor / unbound debit rejected</Pill>
          <Pill tone="success">Employee Continuity Desk remint</Pill>
          <Pill tone="warning">Fake NACHA/presentment simulator</Pill>
          <Pill tone="neutral">Not live Symitar/FedACH</Pill>
        </Row>
        <Text size="small" tone="secondary">
          Judges reward an inspectable policy + demo that clicks. Say production
          uses TCH-class tokens / core VANs + ODFI returns — you are designing
          the member/employee control plane.
        </Text>
      </Stack>

      <Text size="small" tone="secondary">
        Related: canvases/welcome-meeting-idea-comparison.canvas.tsx ·
        docs/welcome-meeting-transcript.md
      </Text>
    </Stack>
  );
}
