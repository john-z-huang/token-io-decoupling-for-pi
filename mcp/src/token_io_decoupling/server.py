"""Official MCP v2 stdio transport for the bounded Token I/O API."""

from __future__ import annotations

from importlib import resources
from pathlib import Path
from typing import Any, cast

from mcp.server import MCPServer
from token_io_decoupling_core.binding import BindingError, BindingProvider, DenyingBindingProvider
from token_io_decoupling_core.codex_context import CodexCallerBoundProvider
from token_io_decoupling_core.rules import RuleLoader
from token_io_decoupling_core.server_tools import (
    TOOLS_SERVER_NAME,
    TOOLS_SERVER_TOOLS,
)
from token_io_decoupling_tools.compliance_preflight import CompliancePreflightService
from token_io_decoupling_tools.output_materialization import (
    OutputMaterializationService,
    OutputMaterializerConfig,
)
from token_io_decoupling_tools.serena_memory import SerenaMemoryReadService
from token_io_decoupling_tools.tools import register_tools
from token_io_decoupling_transport.identity import (
    bound_role as _bound_role,
)
from token_io_decoupling_transport.registration import ToolRegistrar
from token_io_decoupling_transport.tool_metadata import (
    tools_server_description,
    tools_server_instructions,
)


def create_tools_server(
    binding_provider: BindingProvider | None = None,
    *,
    require_bound: bool = False,
    require_codex_context: bool = False,
    serena_memory_service: SerenaMemoryReadService | None = None,
    compliance_service: CompliancePreflightService | None = None,
    output_materializer_config: OutputMaterializerConfig | None = None,
) -> MCPServer[Any]:
    local = binding_provider is None
    provider = binding_provider or DenyingBindingProvider()
    registry_resource = resources.files("token_io_decoupling_core").joinpath(
        "_resources", "registry.json"
    )
    rules = (
        RuleLoader()
        if registry_resource.is_file()
        else RuleLoader(repository_root=Path(__file__).resolve().parents[3])
    )
    if serena_memory_service is not None and not isinstance(
        serena_memory_service, SerenaMemoryReadService
    ):
        raise TypeError("serena_memory_service must be a SerenaMemoryReadService")
    if compliance_service is not None and not isinstance(
        compliance_service, CompliancePreflightService
    ):
        raise TypeError("compliance_service must be a CompliancePreflightService")
    bound_role = _bound_role(provider) if binding_provider is not None else None
    if require_bound and bound_role is None:
        raise BindingError("authenticated host channel did not provide a usable bound identity")
    embedded = bound_role is not None
    if require_codex_context and not embedded and not local:
        raise BindingError("Codex caller matching requires a usable bound identity")

    # Upstream owns validation-error redaction and development tool registrations.
    from dev_workflow_standards_tools import server as development

    server_type = development._SafeMCPServer
    description = tools_server_description() + " " + development.SERVER_DESCRIPTION
    instructions = tools_server_instructions() + " " + development.SERVER_INSTRUCTIONS
    server = server_type(
        name=TOOLS_SERVER_NAME,
        version="0.1.0",
        description=description,
        instructions=instructions,
    )

    state_provider = CodexCallerBoundProvider(provider) if require_codex_context else provider
    output_materializer = (
        OutputMaterializationService(
            authorization_provider=output_materializer_config.authorization_provider,
            compliance_service=compliance_service,
            config=output_materializer_config,
        )
        if (output_materializer_config is not None and compliance_service is not None)
        else None
    )
    registrar = ToolRegistrar(
        server,
        provider=provider,
        state_provider=state_provider,
        allowed_tools=TOOLS_SERVER_TOOLS,
        require_codex_context=require_codex_context,
        bound_role_for=_bound_role,
    )
    register_tools(
        registrar,
        serena_memory_service=serena_memory_service,
        compliance_service=compliance_service,
        rules=rules,
        provider=provider,
        output_materializer=output_materializer,
    )
    if development is not None:
        for register in (
            development.register_git_tools,
            development.register_repository_tools,
            development.register_github_tools,
            development.register_codex_session_fact_tools,
            development.register_ai_workflow_tools,
        ):
            register(server)
    discovered = [tool.name for tool in server._tool_manager.list_tools()]
    actual = set(discovered)
    if len(discovered) != len(actual) or actual != TOOLS_SERVER_TOOLS:
        raise ValueError(
            "MCP server inventory differs from its fixed manifest "
            f"(missing={sorted(TOOLS_SERVER_TOOLS - actual)!r}, "
            f"unexpected={sorted(actual - TOOLS_SERVER_TOOLS)!r})"
        )
    cast(Any, server)._output_materializer = output_materializer
    return server
