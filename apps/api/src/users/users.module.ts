import { Body, ConflictException, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags, PartialType } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { AdminOnly, Roles } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';

class CreateAdminUserDto {
  @IsEmail() email: string;
  @IsString() name: string;
  @IsString() @MinLength(10) password: string;
  @IsOptional() @IsEnum(AdminRole) role?: AdminRole;
}

class UpdateAdminUserDto extends PartialType(CreateAdminUserDto) {
  @IsOptional() @IsBoolean() active?: boolean;
}

const safe = { id: true, email: true, name: true, role: true, active: true, createdAt: true };

@Injectable()
class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list() { return this.prisma.adminUser.findMany({ select: safe, orderBy: { createdAt: 'asc' } }); }

  async create(dto: CreateAdminUserDto) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.adminUser.findUnique({ where: { email } })) throw new ConflictException('Email already in use');
    return this.prisma.adminUser.create({
      data: { email, name: dto.name, role: dto.role, passwordHash: await bcrypt.hash(dto.password, 12) },
      select: safe,
    });
  }

  async update(id: string, dto: UpdateAdminUserDto) {
    if (!(await this.prisma.adminUser.findUnique({ where: { id } }))) throw new NotFoundException('User not found');
    const { password, email, ...rest } = dto;
    return this.prisma.adminUser.update({
      where: { id },
      data: { ...rest, ...(email && { email: email.toLowerCase() }), ...(password && { passwordHash: await bcrypt.hash(password, 12) }) },
      select: safe,
    });
  }

  async deactivate(id: string) {
    if (!(await this.prisma.adminUser.findUnique({ where: { id } }))) throw new NotFoundException('User not found');
    return this.prisma.adminUser.update({ where: { id }, data: { active: false }, select: safe });
  }
}

@ApiTags('Admin - Users')
@AdminOnly()
@Roles('ADMIN')
@Controller('admin/users')
class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get() list() { return this.users.list(); }
  @Post() create(@Body() dto: CreateAdminUserDto) { return this.users.create(dto); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAdminUserDto) { return this.users.update(id, dto); }
  @Delete(':id') deactivate(@Param('id', ParseUUIDPipe) id: string) { return this.users.deactivate(id); }
}

@Module({ controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}
