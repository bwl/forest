# Kingdom Technical Specification

**Version**: 1.0
**Status**: Design Proposal
**Last Updated**: 2025-10-24

---

## What Kingdom Really Is

Kingdom is **NOT** just a CRUD app over Forest (that would be Rails).

Kingdom is:

```
Temporal.io (workflow orchestration)
  + LangChain (LLM operations)
  + n8n (visual workflows)
  + GitHub Actions (execution engine)
  + Forest (knowledge graph)
  = Kingdom
```

**Core Function**: Durable, intelligent workflow orchestration with knowledge graph integration.

---

## The Rails Analogy Is Wrong

### Why Rails Doesn't Fit

**Rails** is:
- CRUD over a database
- Request/response HTTP
- Stateless (or session in cache)
- Business logic in controllers/models

**Kingdom** is:
- **Stateful workflows** with sessions
- **Durable execution** (survives restarts)
- **Event-driven** (not just request/response)
- **LLM-powered** decision making
- **Long-running** tasks (minutes to hours)
- **Multi-step** coordination
- **Knowledge-aware** (queries Forest for context)

### Better Analogies

**Kingdom is like**:

1. **Temporal.io** - Workflow engine
   - Sessions = Workflows
   - Tasks = Activities
   - Durable execution
   - Replay-based recovery

2. **Airflow** - Task orchestration
   - DAG execution
   - Task dependencies
   - Retry logic
   - Monitoring

3. **LangChain / LangGraph** - LLM agents
   - Agent coordination
   - Tool calling
   - Context management
   - Multi-step reasoning

4. **GitHub Actions** - CI/CD workflows
   - YAML-defined workflows
   - Runner dispatch
   - Matrix builds
   - Secret injection

**Kingdom = All of the above, specialized for knowledge work over Forest**

---

## Core Abstractions

### 1. Session (Workflow Instance)

A **Session** is a logical unit of work with durable state.

```typescript
type Session = {
  id: SessionId;                    // sess-a8f2
  intent: Intent;                   // What user requested
  state: SessionState;              // Current execution state
  status: 'running' | 'completed' | 'failed' | 'paused';
  events: Event[];                  // Event log (event sourcing)
  context: SessionContext;          // Accumulated context
  checkpoints: Checkpoint[];        // For recovery
  startedAt: Date;
  completedAt?: Date;
  actor: string;                    // Who initiated
};

type SessionState = {
  currentStep: string;              // Where we are in workflow
  variables: Record<string, any>;   // Workflow variables
  nodeIds: string[];                // Forest nodes involved
  artifacts: Artifact[];            // Generated files/outputs
};

type Event = {
  sequence: number;                 // Monotonic
  timestamp: Date;
  type: string;                     // node_created, task_started, etc.
  actor: string;                    // crown, runner, user
  payload: any;
};

type Checkpoint = {
  sequence: number;
  state: SessionState;              // State snapshot
  timestamp: Date;
};
```

**Key Properties**:
- **Durable**: Persisted to Forest as nodes
- **Recoverable**: Can resume from checkpoints
- **Auditable**: Full event log
- **Replayable**: Can reconstruct any past state

### 2. Workflow (Execution Template)

A **Workflow** defines how to execute a type of work.

```typescript
type Workflow = {
  name: string;                     // "deploy_service"
  description: string;
  version: string;                  // Semantic versioning

  inputs: {
    [key: string]: {
      type: 'string' | 'number' | 'boolean' | 'object';
      required: boolean;
      description: string;
      default?: any;
    };
  };

  steps: Step[];                    // Execution steps

  hooks?: {
    onStart?: Hook;
    onComplete?: Hook;
    onError?: Hook;
  };
};

type Step = {
  id: string;
  name: string;
  type: 'task' | 'decision' | 'parallel' | 'loop' | 'llm';

  // Task execution
  task?: {
    runner: string;                 // runner.deploy
    vars: Record<string, any>;
  };

  // LLM decision
  llm?: {
    prompt: string;
    model: string;
    outputSchema: JSONSchema;       // Structured output
  };

  // Parallel execution
  parallel?: {
    steps: Step[];
  };

  // Conditional logic
  condition?: {
    expression: string;             // JavaScript expression
    then: Step[];
    else?: Step[];
  };

  // Dependencies
  dependsOn?: string[];             // Step IDs

  // Retry policy
  retry?: {
    maxAttempts: number;
    backoff: 'exponential' | 'linear' | 'fixed';
    initialDelay: number;
  };

  // Timeout
  timeout?: number;                 // milliseconds
};

type Hook = {
  type: 'llm' | 'task' | 'webhook';
  config: any;
};
```

**Example Workflow**:

```yaml
# workflows/deploy_service.yaml
name: deploy_service
version: 1.0.0
description: Deploy a service to an environment

inputs:
  service:
    type: string
    required: true
  version:
    type: string
    required: true
  environment:
    type: string
    required: true
    enum: [dev, staging, prod]

steps:
  # Step 1: Validate inputs
  - id: validate
    name: Validate deployment
    type: llm
    llm:
      model: claude-sonnet-4
      prompt: |
        Check if deployment is safe:
        - Service: {{service}}
        - Version: {{version}}
        - Environment: {{environment}}

        Query Forest for:
        - Past deployments of this service
        - Known issues with this version
        - Environment health

        Return validation result.
      outputSchema:
        type: object
        properties:
          safe: { type: boolean }
          warnings: { type: array }
          recommendations: { type: array }

  # Step 2: Decision based on validation
  - id: decide
    name: Decide whether to proceed
    type: decision
    dependsOn: [validate]
    condition:
      expression: "steps.validate.output.safe === true"
      then:
        - id: deploy
          name: Execute deployment
          type: task
          task:
            runner: runner.deploy
            vars:
              service: "{{inputs.service}}"
              version: "{{inputs.version}}"
              environment: "{{inputs.environment}}"
          retry:
            maxAttempts: 3
            backoff: exponential
            initialDelay: 5000
          timeout: 600000  # 10 minutes
      else:
        - id: abort
          name: Abort deployment
          type: task
          task:
            runner: runner.notify
            vars:
              message: "Deployment aborted: {{steps.validate.output.warnings}}"

  # Step 3: Create Forest summary
  - id: capture_result
    name: Capture deployment result
    type: llm
    dependsOn: [deploy]
    llm:
      model: claude-haiku-4
      prompt: |
        Summarize deployment:
        {{steps.deploy.output}}

        Create Forest node with:
        - What was deployed
        - Success/failure
        - Key metrics
        - Lessons learned
      outputSchema:
        type: object
        properties:
          title: { type: string }
          body: { type: string }
          tags: { type: array }

hooks:
  onComplete:
    type: webhook
    config:
      url: "https://slack.com/api/webhook"
      method: POST
      body:
        text: "Deployment completed: {{inputs.service}} v{{inputs.version}}"
```

### 3. Task (Unit of Work)

A **Task** is a single executable unit dispatched to a Runner.

```typescript
type Task = {
  id: TaskId;                       // TSK-4521
  sessionId: SessionId;             // Parent session
  workflowId?: string;              // Which workflow step
  stepId?: string;                  // Which step in workflow

  template: string;                 // Task template name
  vars: Record<string, any>;        // Input variables

  runner?: RunnerId;                // Assigned runner
  status: TaskStatus;

  startedAt?: Date;
  completedAt?: Date;

  result?: TaskResult;
  error?: TaskError;

  // Retry state
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
};

type TaskStatus =
  | 'pending'      // Waiting to start
  | 'queued'       // Waiting for runner
  | 'running'      // In progress
  | 'succeeded'    // Completed successfully
  | 'failed'       // Failed (exhausted retries)
  | 'cancelled';   // User cancelled

type TaskResult = {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  artifacts?: Artifact[];
  metrics?: Record<string, number>;
  output?: any;                     // Structured output
};

type TaskError = {
  message: string;
  code: string;
  retryable: boolean;
  details?: any;
};
```

### 4. Runner (Execution Engine)

A **Runner** executes tasks.

```typescript
interface IRunner {
  id: string;                       // runner.deploy-01
  capabilities: string[];           // ["deploy", "kubernetes", "aws"]
  status: RunnerStatus;

  // Execute a task
  execute(task: Task): Promise<TaskResult>;

  // Health check
  healthCheck(): Promise<HealthStatus>;

  // Cancel running task
  cancel(taskId: TaskId): Promise<void>;
}

type RunnerStatus = {
  state: 'idle' | 'busy' | 'offline';
  currentTask?: TaskId;
  capacity: {
    max: number;                    // Max concurrent tasks
    current: number;                // Current task count
  };
  lastHeartbeat: Date;
};
```

**Runner Types**:

1. **Process Runner** - Executes shell commands
2. **Docker Runner** - Runs Docker containers
3. **Kubernetes Runner** - Creates K8s jobs
4. **Lambda Runner** - Invokes AWS Lambda
5. **LLM Runner** - Calls LLM APIs
6. **HTTP Runner** - Makes HTTP requests

### 5. Agent (LLM-Powered Decision Maker)

An **Agent** uses LLMs to make decisions within workflows.

```typescript
interface IAgent {
  name: string;
  model: string;                    // claude-sonnet-4, gpt-4, etc.

  // Make a decision
  decide(
    prompt: string,
    context: AgentContext,
    schema: JSONSchema
  ): Promise<any>;

  // Query Forest
  queryForest(query: string): Promise<ForestResult>;

  // Generate content
  generate(
    prompt: string,
    format: 'text' | 'json' | 'markdown'
  ): Promise<string>;
}

type AgentContext = {
  sessionId: SessionId;
  variables: Record<string, any>;
  forestNodes?: string[];           // Related Forest nodes
  history?: Event[];                // Recent events
};
```

**Agent Examples**:

- **intent-parser**: Parse natural language → structured intent
- **forest-query-engine**: Complex Forest queries with reasoning
- **content-synthesizer**: Generate summaries, reports, proposals
- **validator-agent**: Validate inputs, check preconditions
- **decision-agent**: Make go/no-go decisions based on context

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│  Interface Layer                                    │
│  • CLI (kingdom <command>)                          │
│  • API (POST /api/v1/workflows)                     │
│  • WebSocket (real-time updates)                    │
└──────────────────────┬──────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────┐
│  Orchestration Layer                                │
│  • workflow-executor (runs workflows)               │
│  • session-manager (manages sessions)               │
│  • task-dispatcher (assigns tasks to runners)       │
└──────────────────────┬──────────────────────────────┘
                       │
           ┌───────────┼───────────┐
           │           │           │
           ↓           ↓           ↓
┌──────────────┐ ┌──────────┐ ┌──────────┐
│  Agents      │ │ Runners  │ │ Forest   │
│  (LLM logic) │ │ (Execute)│ │ (Graph)  │
└──────────────┘ └──────────┘ └──────────┘
           │           │           │
           └───────────┴───────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────┐
│  Persistence Layer                                  │
│  • session-ledger (event log → Forest)              │
│  • checkpoint-store (state snapshots → Forest)      │
└─────────────────────────────────────────────────────┘
```

---

## Durable Execution Model

### The Problem

Traditional systems lose state on restart:
- HTTP request fails → lost context
- Process crashes → lost progress
- Network timeout → retry from scratch

### Kingdom's Solution: Event Sourcing + Checkpoints

**Every action is an event**:
```typescript
Event 0: session_opened
Event 1: workflow_started
Event 2: step_started (validate)
Event 3: llm_called (validate check)
Event 4: llm_response (safe: true)
Event 5: step_completed (validate)
Event 6: checkpoint_created ← State snapshot
Event 7: step_started (deploy)
Event 8: task_dispatched (runner.deploy)
Event 9: task_started
Event 10: task_progress (30%)
Event 11: checkpoint_created ← State snapshot
Event 12: task_progress (60%)
--- CRASH HERE ---
--- RESTART ---
Event 12: (last checkpoint loaded)
Event 13: task_resumed
Event 14: task_progress (90%)
Event 15: task_completed
Event 16: step_completed (deploy)
Event 17: session_completed
```

**Recovery**:
1. Load session from Forest
2. Replay events to reconstruct state
3. Resume from last checkpoint
4. Continue execution

**Benefits**:
- ✅ Survives process restarts
- ✅ Full audit trail
- ✅ Time travel (replay to any point)
- ✅ Exactly-once semantics
- ✅ Can pause/resume workflows

---

## Workflow Execution Engine

### Executor Implementation

```typescript
class WorkflowExecutor {
  private forest: IForestClient;
  private sessionLedger: SessionLedger;
  private agents: Map<string, IAgent>;
  private runners: Map<string, IRunner>;

  async execute(
    workflow: Workflow,
    inputs: Record<string, any>,
    actor: string
  ): Promise<SessionId> {
    // 1. Open session
    const sessionId = await this.sessionLedger.openSession({
      action: 'execute_workflow',
      entity: workflow.name,
      vars: inputs
    }, actor);

    // 2. Validate inputs
    this.validateInputs(workflow.inputs, inputs);

    // 3. Initialize state
    const state: SessionState = {
      currentStep: workflow.steps[0].id,
      variables: { ...inputs },
      nodeIds: [],
      artifacts: []
    };

    // 4. Execute steps
    try {
      for (const step of workflow.steps) {
        await this.executeStep(sessionId, step, state);

        // Create checkpoint every N steps
        if (step.id.endsWith('0')) {
          await this.createCheckpoint(sessionId, state);
        }
      }

      // 5. Complete session
      await this.sessionLedger.commitSession(sessionId);

      return sessionId;

    } catch (error) {
      // 6. Handle failure
      await this.sessionLedger.abortSession(sessionId, error.message);
      throw error;
    }
  }

  private async executeStep(
    sessionId: SessionId,
    step: Step,
    state: SessionState
  ): Promise<void> {
    await this.sessionLedger.logEvent(sessionId, {
      actor: 'workflow-executor',
      action: 'step_started',
      target: step.id
    });

    switch (step.type) {
      case 'task':
        await this.executeTask(sessionId, step, state);
        break;

      case 'llm':
        await this.executeLLM(sessionId, step, state);
        break;

      case 'decision':
        await this.executeDecision(sessionId, step, state);
        break;

      case 'parallel':
        await this.executeParallel(sessionId, step, state);
        break;
    }

    await this.sessionLedger.logEvent(sessionId, {
      actor: 'workflow-executor',
      action: 'step_completed',
      target: step.id
    });
  }

  private async executeTask(
    sessionId: SessionId,
    step: Step,
    state: SessionState
  ): Promise<void> {
    // 1. Create task in Forest
    const task = await this.forest.createNode({
      title: `Task: ${step.name}`,
      tags: ['task', 'state:pending', `template:${step.task.runner}`],
      metadata: {
        sessionId,
        stepId: step.id,
        vars: step.task.vars
      }
    });

    state.nodeIds.push(task.id);

    // 2. Dispatch to runner
    const runner = this.runners.get(step.task.runner);
    if (!runner) {
      throw new Error(`Runner not found: ${step.task.runner}`);
    }

    await this.sessionLedger.logEvent(sessionId, {
      actor: 'task-dispatcher',
      action: 'task_dispatched',
      target: task.id,
      after: { runner: runner.id }
    });

    // 3. Execute with retry logic
    const result = await this.executeWithRetry(
      () => runner.execute({
        id: task.id,
        sessionId,
        template: step.task.runner,
        vars: step.task.vars,
        status: 'running',
        attempts: 0,
        maxAttempts: step.retry?.maxAttempts || 1
      }),
      step.retry
    );

    // 4. Update task in Forest
    await this.forest.updateNode(task.id, {
      tags: ['task', 'state:succeeded', `template:${step.task.runner}`],
      metadata: { ...task.metadata, result }
    });

    // 5. Store result in state
    state.variables[`steps.${step.id}.output`] = result.output;
    if (result.artifacts) {
      state.artifacts.push(...result.artifacts);
    }
  }

  private async executeLLM(
    sessionId: SessionId,
    step: Step,
    state: SessionState
  ): Promise<void> {
    const agent = this.agents.get(step.llm.model);
    if (!agent) {
      throw new Error(`Agent not found: ${step.llm.model}`);
    }

    // Interpolate prompt with state variables
    const prompt = this.interpolate(step.llm.prompt, state.variables);

    await this.sessionLedger.logEvent(sessionId, {
      actor: 'llm-agent',
      action: 'llm_called',
      target: step.id,
      after: { model: step.llm.model, prompt }
    });

    // Call LLM with structured output
    const result = await agent.decide(
      prompt,
      {
        sessionId,
        variables: state.variables,
        forestNodes: state.nodeIds
      },
      step.llm.outputSchema
    );

    await this.sessionLedger.logEvent(sessionId, {
      actor: 'llm-agent',
      action: 'llm_response',
      target: step.id,
      after: { result }
    });

    // Store result in state
    state.variables[`steps.${step.id}.output`] = result;
  }

  private async executeDecision(
    sessionId: SessionId,
    step: Step,
    state: SessionState
  ): Promise<void> {
    // Evaluate condition
    const condition = this.evaluateExpression(
      step.condition.expression,
      state.variables
    );

    await this.sessionLedger.logEvent(sessionId, {
      actor: 'workflow-executor',
      action: 'decision_evaluated',
      target: step.id,
      after: { condition, expression: step.condition.expression }
    });

    // Execute branch
    const branch = condition ? step.condition.then : step.condition.else;
    if (branch) {
      for (const branchStep of branch) {
        await this.executeStep(sessionId, branchStep, state);
      }
    }
  }

  private async executeParallel(
    sessionId: SessionId,
    step: Step,
    state: SessionState
  ): Promise<void> {
    // Execute all steps in parallel
    await Promise.all(
      step.parallel.steps.map(s => this.executeStep(sessionId, s, state))
    );
  }

  private interpolate(
    template: string,
    variables: Record<string, any>
  ): string {
    return template.replace(
      /\{\{([^}]+)\}\}/g,
      (_, key) => {
        const value = this.resolvePath(variables, key.trim());
        return value !== undefined ? String(value) : '';
      }
    );
  }

  private resolvePath(obj: any, path: string): any {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  private evaluateExpression(
    expr: string,
    variables: Record<string, any>
  ): boolean {
    // Simple expression evaluator
    // In production, use a safe eval library
    const fn = new Function(...Object.keys(variables), `return ${expr}`);
    return fn(...Object.values(variables));
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retry?: Step['retry']
  ): Promise<T> {
    const maxAttempts = retry?.maxAttempts || 1;
    const backoff = retry?.backoff || 'exponential';
    const initialDelay = retry?.initialDelay || 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }

        // Calculate delay
        let delay = initialDelay;
        if (backoff === 'exponential') {
          delay = initialDelay * Math.pow(2, attempt - 1);
        } else if (backoff === 'linear') {
          delay = initialDelay * attempt;
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private async createCheckpoint(
    sessionId: SessionId,
    state: SessionState
  ): Promise<void> {
    const session = this.sessionLedger.getSession(sessionId);
    const checkpoint: Checkpoint = {
      sequence: session.events.length,
      state: JSON.parse(JSON.stringify(state)), // Deep copy
      timestamp: new Date()
    };

    // Store checkpoint in Forest
    await this.forest.createNode({
      title: `Checkpoint: ${sessionId} @ ${checkpoint.sequence}`,
      tags: ['checkpoint', `session:${sessionId}`],
      body: JSON.stringify(checkpoint, null, 2),
      metadata: { sessionId, sequence: checkpoint.sequence }
    });

    await this.sessionLedger.logEvent(sessionId, {
      actor: 'workflow-executor',
      action: 'checkpoint_created',
      after: { sequence: checkpoint.sequence }
    });
  }
}
```

---

## Plugin System

Kingdom is extensible via plugins.

### Plugin Types

**1. Runner Plugins**
```typescript
// plugins/runner-terraform/index.ts
export class TerraformRunner implements IRunner {
  id = 'runner.terraform';
  capabilities = ['terraform', 'iac', 'aws'];

  async execute(task: Task): Promise<TaskResult> {
    // Run terraform apply
    const { workspace, vars } = task.vars;

    const result = await exec(`terraform apply -auto-approve`, {
      cwd: workspace,
      env: { ...process.env, ...vars }
    });

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      artifacts: [
        { type: 'tfstate', path: `${workspace}/terraform.tfstate` }
      ]
    };
  }

  async healthCheck(): Promise<HealthStatus> {
    // Check terraform CLI availability
    const result = await exec('terraform version');
    return {
      healthy: result.exitCode === 0,
      version: parseVersion(result.stdout)
    };
  }
}

// Register plugin
export default function register(kingdom: Kingdom) {
  kingdom.registerRunner(new TerraformRunner());
}
```

**2. Agent Plugins**
```typescript
// plugins/agent-code-reviewer/index.ts
export class CodeReviewerAgent implements IAgent {
  name = 'code-reviewer';
  model = 'claude-sonnet-4';

  async decide(
    prompt: string,
    context: AgentContext,
    schema: JSONSchema
  ): Promise<any> {
    // Review code changes
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: this.model,
      messages: [{
        role: 'user',
        content: prompt
      }],
      // Use schema for structured output
      ...this.schemaToAnthropicFormat(schema)
    });

    return JSON.parse(response.content[0].text);
  }

  async queryForest(query: string): Promise<ForestResult> {
    // Query Forest for past code reviews, patterns
    const forest = new ForestClient();
    return forest.search(query);
  }
}
```

**3. Workflow Plugins**
```typescript
// plugins/workflows/deploy-microservice/workflow.yaml
name: deploy_microservice
version: 1.0.0
author: acme-corp

inputs:
  service: { type: string, required: true }
  environment: { type: string, required: true }

steps:
  - id: build
    type: task
    task:
      runner: runner.docker
      vars:
        dockerfile: "./services/{{inputs.service}}/Dockerfile"
        tag: "{{inputs.service}}:{{env.GIT_SHA}}"

  - id: test
    type: task
    dependsOn: [build]
    task:
      runner: runner.pytest
      vars:
        tests: "./services/{{inputs.service}}/tests"

  - id: deploy
    type: task
    dependsOn: [test]
    task:
      runner: runner.kubernetes
      vars:
        manifest: "./k8s/{{inputs.environment}}/{{inputs.service}}.yaml"
        image: "{{steps.build.output.imageUri}}"
```

### Plugin Discovery

```bash
# Install plugin
kingdom plugin install @kingdom/runner-terraform

# List plugins
kingdom plugin list

# Plugin directory structure
~/.kingdom/plugins/
├── @kingdom/
│   ├── runner-terraform/
│   ├── runner-docker/
│   └── agent-code-reviewer/
└── @acme-corp/
    └── workflows-deploy/
```

---

## API Design

### REST API

```typescript
// Start workflow execution
POST /api/v1/workflows/deploy_service/execute
{
  "inputs": {
    "service": "api-gateway",
    "version": "v1.2.3",
    "environment": "staging"
  },
  "actor": "alice@acme.com"
}

Response:
{
  "sessionId": "sess-a8f2",
  "status": "running",
  "startedAt": "2025-10-24T10:00:00Z"
}

// Get session status
GET /api/v1/sessions/sess-a8f2

Response:
{
  "sessionId": "sess-a8f2",
  "workflow": "deploy_service",
  "status": "running",
  "currentStep": "deploy",
  "progress": 0.75,
  "events": [...],
  "state": {...}
}

// List sessions
GET /api/v1/sessions?status=running&actor=alice@acme.com

// Cancel session
POST /api/v1/sessions/sess-a8f2/cancel

// Retry failed session
POST /api/v1/sessions/sess-a8f2/retry

// Replay session (debugging)
POST /api/v1/sessions/sess-a8f2/replay
```

### WebSocket API (Real-time Updates)

```typescript
// Client connects
const ws = new WebSocket('ws://kingdom.acme.com/api/v1/ws');

// Subscribe to session
ws.send(JSON.stringify({
  type: 'subscribe',
  sessionId: 'sess-a8f2'
}));

// Receive events in real-time
ws.onmessage = (msg) => {
  const event = JSON.parse(msg.data);

  switch (event.type) {
    case 'step_started':
      console.log(`Step ${event.stepId} started`);
      break;

    case 'task_progress':
      updateProgressBar(event.percent);
      break;

    case 'session_completed':
      console.log('Workflow completed!');
      break;
  }
};
```

---

## Deployment Models

### 1. Standalone (Development)

```
┌──────────────────────┐
│  kingdom             │
│  • CLI               │
│  • Executor          │
│  • Built-in runners  │
│  • Local Forest      │
└──────────────────────┘
```

**Use Case**: Local development, testing workflows

### 2. Client-Server (Small Team)

```
Developer Laptops:
┌──────────────┐  ┌──────────────┐
│ kingdom CLI  │  │ kingdom CLI  │
└──────┬───────┘  └──────┬───────┘
       │                 │
       └────────┬────────┘
                ↓ HTTPS
Central Server:
┌──────────────────────────────┐
│  kingdom serve               │
│  • Workflow executor         │
│  • Runner pool               │
│  → forest API (remote)       │
└──────────────────────────────┘
```

**Use Case**: Team collaboration, shared runners

### 3. Distributed (Enterprise)

```
                API Gateway
                     │
        ┌────────────┼────────────┐
        │            │            │
        ↓            ↓            ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Kingdom      │ │ Kingdom      │ │ Kingdom      │
│ Instance 1   │ │ Instance 2   │ │ Instance 3   │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                        ↓
                ┌──────────────┐
                │ Message Queue│
                │ (Redis/NATS) │
                └──────┬───────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ↓              ↓              ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Runner Pool  │ │ Runner Pool  │ │ Runner Pool  │
│ (K8s pods)   │ │ (AWS Lambda) │ │ (VMs)        │
└──────────────┘ └──────────────┘ └──────────────┘
                       │
                       ↓
                ┌──────────────┐
                │ Forest API   │
                │ (Clustered)  │
                └──────────────┘
```

**Use Case**: High availability, horizontal scaling

---

## Use Cases

### 1. Software Deployment

```bash
kingdom "Deploy api-gateway v2.1.0 to staging"
```

**Workflow**:
1. Parse intent → extract service, version, environment
2. Query Forest for:
   - Past deployments of api-gateway
   - Known issues with v2.1.0
   - Staging environment health
3. LLM validation: "Is this safe to deploy?"
4. If safe:
   - Build Docker image
   - Run tests
   - Deploy to Kubernetes
   - Run smoke tests
5. Capture result in Forest
6. Link to related deployments

### 2. Customer Proposal Generation

```bash
kingdom "Prepare proposal for John Smith in Wantagh - whole home water filtration"
```

**Workflow**:
1. Parse intent → extract client info, service type
2. Query Forest for:
   - Similar past projects (geographic + domain)
   - Product catalog
   - Pricing templates
   - Local regulations
3. LLM synthesis:
   - Generate 6-page proposal
   - Include testimonials
   - Customize pricing
4. Create PDF artifacts
5. Capture proposal in Forest
6. Auto-link to related projects

### 3. Incident Response

```bash
kingdom "Production alert: API latency >5s"
```

**Workflow**:
1. Parse alert
2. Query Forest for:
   - Similar past incidents
   - Resolution playbooks
   - On-call schedule
3. LLM analysis: "What's the likely root cause?"
4. Execute diagnostics (parallel):
   - Check database connections
   - Review recent deployments
   - Analyze logs
5. LLM recommendation: "Suggested remediation"
6. If approved:
   - Execute fix (rollback, restart, scale, etc.)
7. Capture incident report in Forest

### 4. Code Review Automation

```bash
kingdom "Review PR #1234"
```

**Workflow**:
1. Fetch PR diff from GitHub
2. Query Forest for:
   - Coding standards
   - Past reviews of similar code
   - Common issues
3. LLM review:
   - Check for bugs
   - Security vulnerabilities
   - Performance issues
   - Style violations
4. Generate review comments
5. Post to GitHub
6. Capture review in Forest

---

## Why Kingdom Is Not Rails

| Aspect | Rails | Kingdom |
|--------|-------|---------|
| **Execution** | Request/response | Durable workflows |
| **State** | Stateless (or session) | Stateful sessions |
| **Duration** | Milliseconds | Seconds to hours |
| **Recovery** | Retry request | Resume from checkpoint |
| **Orchestration** | Controllers | Workflow engine |
| **Intelligence** | Business logic | LLM agents |
| **Persistence** | ORM over DB | Event sourcing |
| **Concurrency** | Thread pool | Parallel steps, distributed runners |

**Kingdom is**:
- Temporal (workflow orchestration)
- + LangChain (LLM operations)
- + Forest (knowledge graph)
- + Plugin system (extensibility)

**Not**:
- Rails (CRUD over database)

---

## Implementation Priority

### Phase 1: Core Engine (Week 1-2)
- [ ] Session management (open, commit, abort)
- [ ] Event sourcing (log events to Forest)
- [ ] Workflow executor (basic step execution)
- [ ] Task dispatch (select & invoke runners)

### Phase 2: Built-in Runners (Week 3)
- [ ] Process runner (shell commands)
- [ ] Docker runner
- [ ] HTTP runner
- [ ] LLM runner

### Phase 3: Agents (Week 4)
- [ ] intent-parser
- [ ] forest-query-engine
- [ ] content-synthesizer

### Phase 4: Durability (Week 5)
- [ ] Checkpointing
- [ ] Recovery from checkpoints
- [ ] Retry logic
- [ ] Timeout handling

### Phase 5: API (Week 6)
- [ ] REST API
- [ ] WebSocket API
- [ ] CLI commands

### Phase 6: Plugins (Week 7-8)
- [ ] Plugin system
- [ ] Example plugins
- [ ] Documentation

---

## Conclusion

**Kingdom is a durable, intelligent workflow orchestration system specialized for knowledge work over Forest.**

It's not Rails (CRUD app).
It's not just Temporal (no LLM intelligence).
It's not just LangChain (no durable execution).

**Kingdom = Workflows + LLMs + Knowledge Graph**

The killer feature: **Every workflow learns from past executions stored in Forest, getting smarter over time.**
