import {
    CallHandler,
    ExecutionContext,
    NestInterceptor,
    Inject,
    mixin,
    UnauthorizedException,
    NotImplementedException,
    BadRequestException,
  } from '@nestjs/common';
  import { Observable } from 'rxjs';
  import { TypeOrmCrudService } from '@nestjsx/crud-typeorm';
  import { getRepositoryToken } from '@nestjs/typeorm';
  import { Repository } from 'typeorm';


  export function MixinCheckOwnershipCreate<T extends new (...args: any[]) => any>(
    entityClass: T,
    possibleFields: string[] = ['id'],
    role: string = "Customer"
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
         

            const objectsCreated = [];
            if(req.body.bulk){
              req.body.bulk.forEach((o: any)=>{
                  objectsCreated.push(o);
              });
            }
            else{
              objectsCreated.push(req.body);
            }

            

            objectsCreated.forEach(objectCreated => {
                let fieldFound = false;
                possibleFields.sort((one, two) => (one > two ? -1 : 1)).forEach(field => {
                  if(fieldFound){
                      return;
                  }
                  const fields =  field.split('.');
                  let objectParsed = objectCreated;
                  fields.forEach((f,i) => {
                      if(objectParsed[f]){
                          objectParsed = objectParsed[f];
                          if(i === fields.length -1){
                              objectParsed = Number(objectParsed);
                              if(role === "Customer" && objectParsed !== req.user.id){
                                  throw new UnauthorizedException("Customer different than authenthicated user");
                              }
                              else if(role === "Manager" && !req.user.merchantIds.includes(objectParsed)){
                                  throw new UnauthorizedException("Merchant Id does not belong to user " + JSON.stringify(req.user.merchantIds) + " " + JSON.stringify(objectParsed));
                              }
                              else{
                                  fieldFound = true;
                              }
                          }
                      }
                  });
              });
              if(!fieldFound){
                throw new BadRequestException("None of the fields found:" + possibleFields.toString());
              }
            });
        }
        return next.handle();
      }

    }
    return mixin(CheckOwnershipInterceptor);
  }