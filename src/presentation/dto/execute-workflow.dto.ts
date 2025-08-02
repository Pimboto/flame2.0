import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class ExecuteWorkflowDto {
  @IsString()
  @IsNotEmpty()
  workflowId!: string;

  @IsObject()
  @IsOptional()
  data?: any;
}
