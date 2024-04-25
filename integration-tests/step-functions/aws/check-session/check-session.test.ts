import { stackOutputs } from "../../../resources/cloudformation-helper";
import { clearItems, populateTable } from "../../../resources/dynamodb-helper";
import { executeStepFunction } from "../../../resources/stepfunction-helper";

describe("check-session", () => {
  const input = {
    sessionId: "session-test",
  };

  let output: Partial<{
    CommonStackName: string;
    CheckSessionStateMachineArn: string;
  }>;

  let sessionTableName: string;

  beforeEach(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    sessionTableName = `session-${output.CommonStackName}`;
  });

  afterEach(async () => {
    await clearItems(sessionTableName, {
      sessionId: input.sessionId,
    });
  });

  it("should return SESSION_OK when session has not expired", async () => {
    await populateTable(sessionTableName, {
      sessionId: input.sessionId,
      expiryDate: 9999999999,
      clientId: "exampleClientId",
      subject: "test",
      clientIpAddress: "00.100.8.20",
      clientSessionId: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
      persistentSessionId: "156714ef-f9df-48c2-ada8-540e7bce44f7",
    });

    const startExecutionResult = await executeStepFunction(
      output.CheckSessionStateMachineArn as string,
      input
    );

    const result = JSON.parse(startExecutionResult.output || "");
    expect(result.status).toBe("SESSION_OK");
    expect(result.clientId).toBe("exampleClientId");
  });

  it("should throw an error when there is no clientId present within the session table", async () => {
    await populateTable(sessionTableName, {
      sessionId: input.sessionId,
      expiryDate: 9999999999,
    });

    const startExecutionResult = await executeStepFunction(
      output.CheckSessionStateMachineArn as string,
      input
    );

    expect(startExecutionResult.output).toBeUndefined();
  });

  it("should return SESSION_NOT_FOUND when sessionId does not exist", async () => {
    const startExecutionResult = await executeStepFunction(
      output.CheckSessionStateMachineArn as string,
      input
    );

    expect(startExecutionResult.output).toBe('{"status":"SESSION_NOT_FOUND"}');
  });

  it("should return SESSION_EXPIRED when session has expired", async () => {
    await populateTable(sessionTableName, {
      sessionId: input.sessionId,
      expiryDate: 0,
    });

    const startExecutionResult = await executeStepFunction(
      output.CheckSessionStateMachineArn as string,
      input
    );

    expect(startExecutionResult.output).toBe('{"status":"SESSION_EXPIRED"}');
  });

  it("should return SESSION_NOT_PROVIDED when sessionId is missing", async () => {
    const startExecutionResult = await executeStepFunction(
      output.CheckSessionStateMachineArn as string
    );

    expect(startExecutionResult.output).toBe(
      '{"status":"SESSION_NOT_PROVIDED"}'
    );
  });
});
