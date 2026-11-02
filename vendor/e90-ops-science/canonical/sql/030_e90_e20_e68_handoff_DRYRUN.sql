/*
E90 -> E68 Wizard -> E20 handoff
DESIGN-ONLY PostgreSQL 16 DDL. DO NOT EXECUTE.
*/

BEGIN;

CREATE TABLE IF NOT EXISTS ops_mgt.efficiency_recommendation_outbox (
    recommendation_id              uuid NOT NULL,
    recommendation_version         text NOT NULL,
    recommendation_sha256          text NOT NULL,
    recommendation_class           text NOT NULL,
    implementation_class           text NOT NULL,
    scope_kind                     text NOT NULL,
    tenant_id                      uuid,
    candidate_id                   uuid,
    optimization_run_id            uuid NOT NULL REFERENCES ops_mgt.optimization_run(optimization_run_id),
    e72_plan_ref                    text,
    recommendation_payload         jsonb NOT NULL,
    wizard_state                   text NOT NULL DEFAULT 'NOT_PRESENTED',
    e20_state                      text NOT NULL DEFAULT 'NOT_RECEIVED',
    execution_allowed              boolean NOT NULL DEFAULT false,
    expires_at                     timestamptz NOT NULL,
    created_at                     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (recommendation_id, recommendation_version),
    CHECK (recommendation_sha256 ~ '^[a-f0-9]{64}$'),
    CHECK (recommendation_class IN ('CAMPAIGN_PLAN_EFFICIENCY', 'QUEUE_POLICY_EFFICIENCY', 'CAPACITY_INVESTMENT', 'DATA_QUALITY_EFFICIENCY', 'MODEL_RECALIBRATION', 'CONFIGURATION_CHANGE', 'CODE_SCHEMA_DEPLOYMENT', 'ADVISORY_ONLY')),
    CHECK (implementation_class IN ('ADVISORY', 'CAMPAIGN_PLAN_INPUT', 'QUEUE_POLICY', 'CONFIGURATION', 'CODE', 'SCHEMA', 'INFRASTRUCTURE', 'EXTERNAL_ACTION')),
    CHECK (scope_kind IN ('GLOBAL_NONCANDIDATE', 'CANDIDATE')),
    CHECK (
        (scope_kind = 'GLOBAL_NONCANDIDATE' AND tenant_id IS NULL AND candidate_id IS NULL)
        OR
        (scope_kind = 'CANDIDATE' AND tenant_id IS NOT NULL AND candidate_id IS NOT NULL)
    ),
    CHECK (
        recommendation_class <> 'CAMPAIGN_PLAN_EFFICIENCY'
        OR e72_plan_ref IS NOT NULL
    ),
    CHECK (wizard_state IN ('NOT_PRESENTED', 'PRESENTED', 'AUTHORIZED', 'REJECTED', 'HELD', 'STALE')),
    CHECK (e20_state IN ('NOT_RECEIVED', 'RECEIVED', 'ACCEPTED', 'HELD', 'REJECTED', 'ROUTED')),
    CHECK (execution_allowed = false)
);

CREATE TABLE IF NOT EXISTS ops_mgt.wizard_efficiency_decision (
    wizard_decision_id              uuid PRIMARY KEY,
    recommendation_id               uuid NOT NULL,
    recommendation_version          text NOT NULL,
    recommendation_sha256           text NOT NULL,
    actor_ref                       text NOT NULL,
    decision                        text NOT NULL,
    conditions_json                 jsonb NOT NULL DEFAULT '[]'::jsonb,
    exclusions_json                 jsonb NOT NULL DEFAULT '[]'::jsonb,
    decided_at                      timestamptz NOT NULL,
    expires_at                      timestamptz NOT NULL,
    revoked_at                      timestamptz,
    consumed_at                     timestamptz,
    signature_algorithm             text NOT NULL,
    signing_key_ref                 text NOT NULL,
    signature_value                 text NOT NULL,
    FOREIGN KEY (recommendation_id, recommendation_version)
        REFERENCES ops_mgt.efficiency_recommendation_outbox(
            recommendation_id,
            recommendation_version
        ),
    CHECK (recommendation_sha256 ~ '^[a-f0-9]{64}$'),
    CHECK (decision IN ('APPROVE_EXACT_VERSION', 'REJECT', 'HOLD')),
    CHECK (expires_at > decided_at),
    CHECK (signature_algorithm = 'ED25519')
);

CREATE TABLE IF NOT EXISTS ops_mgt.e20_efficiency_gate_receipt (
    gate_receipt_id                 uuid PRIMARY KEY,
    recommendation_id               uuid NOT NULL,
    recommendation_version          text NOT NULL,
    wizard_decision_id              uuid NOT NULL REFERENCES ops_mgt.wizard_efficiency_decision(wizard_decision_id),
    gate_result                     text NOT NULL,
    route_result                    text NOT NULL,
    current_state_snapshot_ref      text NOT NULL,
    gate_results_json               jsonb NOT NULL,
    affected_owner_ref              text,
    implementation_work_order_ref   text,
    action_socket_request_ref       text,
    evaluated_at                    timestamptz NOT NULL,
    expires_at                      timestamptz NOT NULL,
    FOREIGN KEY (recommendation_id, recommendation_version)
        REFERENCES ops_mgt.efficiency_recommendation_outbox(
            recommendation_id,
            recommendation_version
        ),
    CHECK (gate_result IN ('GO', 'NO_GO', 'HOLD', 'DEFER', 'REJECTED')),
    CHECK (route_result IN ('ADVISORY_RECORDED', 'E72_PLAN_REQUIRED', 'IMPLEMENTATION_WORK_ORDER', 'ACTION_SOCKET_PREVIEW', 'ACTION_SOCKET_OBSERVE', 'ACTION_SOCKET_FIRE_ELIGIBLE', 'HOLD', 'REJECTED')),
    CHECK (expires_at > evaluated_at),
    CHECK (
        route_result <> 'IMPLEMENTATION_WORK_ORDER'
        OR implementation_work_order_ref IS NOT NULL
    ),
    CHECK (
        route_result NOT IN ('ACTION_SOCKET_PREVIEW', 'ACTION_SOCKET_OBSERVE', 'ACTION_SOCKET_FIRE_ELIGIBLE')
        OR action_socket_request_ref IS NOT NULL
    )
);

ROLLBACK;

