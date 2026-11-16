"""Register bounded utilities without workflow scheduling or decisions."""

from __future__ import annotations

from typing import Any

from token_io_decoupling_core.binding import BindingProvider
from token_io_decoupling_core.materialization_models import MaterializeDecoupledOutputPayload
from token_io_decoupling_core.rules import DEFAULT_CONTEXT_TEXT_BUDGET, RuleLoader
from token_io_decoupling_transport.payloads import _RULE_CONTEXT
from token_io_decoupling_transport.registration import ToolRegistrar

from token_io_decoupling_tools.compliance_preflight import (
    CompliancePreflightService,
    validate_decoupling_compliance,
)
from token_io_decoupling_tools.output_materialization import OutputMaterializationService
from token_io_decoupling_tools.payloads import _COMPLIANCE_PREFLIGHT
from token_io_decoupling_tools.serena_memory import SerenaMemoryReadService
from token_io_decoupling_tools.serena_memory_tools import register_serena_memory_tools


def register_tools(
    registrar: ToolRegistrar,
    *,
    compliance_service: CompliancePreflightService | None,
    rules: RuleLoader,
    provider: BindingProvider,
    serena_memory_service: SerenaMemoryReadService | None = None,
    output_materializer: OutputMaterializationService | None = None,
) -> None:
    register_serena_memory_tools(registrar, serena_memory_service or SerenaMemoryReadService())

    def get_rule_context(payload: Any) -> Any:
        if payload.context_version is None:
            return rules.load_context(payload.node_id.value, language=payload.language)
        return rules.load_context_bundle(
            payload.node_id.value,
            language=payload.language,
            fragment_ids=payload.fragment_ids,
            max_chars=payload.max_chars or DEFAULT_CONTEXT_TEXT_BUDGET,
        )

    registrar.register("rules_get_context", _RULE_CONTEXT, get_rule_context, enhanced=False)
    registrar.register(
        "validate_decoupling_compliance",
        _COMPLIANCE_PREFLIGHT,
        lambda payload: validate_decoupling_compliance(compliance_service, payload.request),
        enhanced=False,
    )

    def materialize_output(payload: Any) -> Any:
        if output_materializer is None:
            return {
                "status": "unavailable",
                "reason_code": "trusted_authorization_context_unavailable",
            }
        return output_materializer.execute(
            payload.request, expected_binding=provider.current_binding()
        )

    registrar.register(
        "materialize_decoupled_output",
        MaterializeDecoupledOutputPayload,
        materialize_output,
        role="worker",
    )
