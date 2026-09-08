import { Body, Controller, Delete, Get, Header, Path, Post, Put, Query, Route, Security, Tags } from "tsoa";
import * as taskService from "@/services/task.service";
import { parseAuthHeader } from "@/middleware/authenticate";
import { createTaskSchema, updateTaskSchema, listTasksQuerySchema } from "@/validators/task.validator";

interface CreateTaskBody {
  title: string;
  description?: string;
  difficulty?: string;
  priority?: string;
  effort: number;
  projectId?: number;
  assignedToId?: number;
  startDate?: string;
  dueDate?: string;
}

interface UpdateTaskBody extends Partial<CreateTaskBody> {
  progressStatus?: string;
}

@Route("tasks")
@Tags("Tasks")
@Security("jwt")
export class TaskController extends Controller {
  @Get("/")
  public async list(
    @Query() page?: number,
    @Query() limit?: number,
    @Query() projectId?: number,
    @Query() assignedToId?: number,
    @Query() progressStatus?: string
  ) {
    const query = listTasksQuerySchema.parse({ page, limit, projectId, assignedToId, progressStatus });
    return taskService.getAllTasks(query);
  }

  @Get("{id}")
  public async getById(@Path() id: number) {
    const data = await taskService.getTaskById(id);
    return { data };
  }

  @Post("/")
  public async create(@Header("authorization") authorization: string, @Body() body: CreateTaskBody) {
    const requester = parseAuthHeader(authorization);
    const input = createTaskSchema.parse(body);
    const data = await taskService.createTask(input, requester);
    this.setStatus(201);
    return { data };
  }

  @Put("{id}")
  public async update(
    @Path() id: number,
    @Header("authorization") authorization: string,
    @Body() body: UpdateTaskBody
  ) {
    const requester = parseAuthHeader(authorization);
    const input = updateTaskSchema.parse(body);
    const data = await taskService.updateTask(id, input, requester);
    return { data };
  }

  @Delete("{id}")
  public async remove(@Path() id: number, @Header("authorization") authorization: string) {
    const requester = parseAuthHeader(authorization);
    await taskService.deleteTask(id, requester);
    this.setStatus(204);
    return;
  }

}
