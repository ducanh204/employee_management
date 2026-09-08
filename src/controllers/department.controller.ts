import { createDepartment, deleteDepartment, getDepartment, listDepartments, updateDepartment } from "@/services/department.service";
import { Body, Controller, Delete, Get, Path, Post, Put, Route, Security, Tags } from "tsoa";
import { CreateDepartmentDto, createDepartmentSchema, UpdateDepartmentDto, updateDepartmentSchema } from "../validators/department.validator";

@Route("departments")
@Tags("departments")
export class DepartmentController extends Controller {

    @Get("/")
    @Security("jwt")
    public async  list()
    {
        return listDepartments();
    }

    @Get("{id}")
    @Security("jwt")
    public async getbyId(
        @Path() id: number
    )
    {
      return getDepartment(id);
    }

    @Post("/")
    @Security("jwt", ["ADMIN"])
    public async create(
        @Body() input: CreateDepartmentDto
    )
    {   
        const parsed = createDepartmentSchema.parse(input);
        this.setStatus(201);
        return createDepartment(parsed);
    }

    @Put("{id}")
    @Security("jwt", ["ADMIN"])
    public async update(
        @Path() id: number,
        @Body() input: UpdateDepartmentDto
    ){
        const parsed = updateDepartmentSchema.parse(input);
        return updateDepartment(id, parsed);
    }

    @Delete("{id}")
    @Security("jwt",["ADMIN"])
    public async delete(
        @Path() id: number,
    )
    
    {
        await deleteDepartment(id)
        this.setStatus(204);
    }
}