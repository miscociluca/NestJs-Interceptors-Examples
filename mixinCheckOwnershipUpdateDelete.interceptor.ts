import {
    CallHandler,
    ExecutionContext,
    NestInterceptor,
    Inject,
    mixin,
    UnauthorizedException,
    NotImplementedException,
    BadRequestException,
    NotFoundException,
  } from '@nestjs/common';
  import { Observable } from 'rxjs';
  import { TypeOrmCrudService } from '@nestjsx/crud-typeorm';
  import { getRepositoryToken } from '@nestjs/typeorm';
  import { Repository } from 'typeorm';


  export function MixinCheckOwnershipUpdateDelete<T extends new (...args: any[]) => any>(
    entityClass: T,
    relationName: string = 'user',
    column: string = 'id',
    role: string = 'Customer'
  ) {
    class CheckOwnershipInterceptor extends TypeOrmCrudService<T>
      implements NestInterceptor {
      constructor(
        @Inject(getRepositoryToken(entityClass))
        protected readonly repo: Repository<T>,
      ) {
        super(repo);
      }
      async intercept(
        context: ExecutionContext,
        next: CallHandler,
      ): Promise<Observable<any>> {
          
        const req = context.switchToHttp().getRequest();
        if (!req.user) {
            throw new NotImplementedException(
              'You Must Implement the Auth guard first',
            );
          }

        if (!req.user.role) {
            throw new NotImplementedException(
              'No role assigned to user',
            );
          }

        if(req.user.role === role){
            
          const relations = [];
          if(relationName && relationName.toLowerCase() !== entityClass.name.toLowerCase()){
            relations.push(relationName);
          }
          let item: any = await this.findOne(req.params.id, {
            relations: relations,
          });
  
          if(!item){
            throw new NotFoundException();
          }


          if(relationName && relationName.toLowerCase() !== entityClass.name.toLowerCase()){
            item = item[relationName];
          }
          const value = Number(item[column]);
          if(!value){
            throw new BadRequestException("Column not found:" + column);
          }
            if(!relationName){ //no relation that means is a self check
                if(value !== req.user.id){
                  throw new UnauthorizedException(req.user.role + " different than authenthicated user");
                }
            }
            else if(role === "Customer" || !relationName){
               if(value !== req.user.id){
                  throw new UnauthorizedException("Customer different than authenthicated user");
               }
            }
            else if(role === "Manager" && !req.user.merchantIds.includes(value)){
              throw new UnauthorizedException("Merchant Id does not belong to user");
           }
        }
        return next.handle();
      }

    }
    return mixin(CheckOwnershipInterceptor);
  }