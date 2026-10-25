import { registerDecorator, ValidationOptions, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator'

@ValidatorConstraint({ name: 'IsLettersAndNumbers', async: false })
export class IsLettersAndNumbersConstraint implements ValidatorConstraintInterface {
  validate(value: string) {
    return /^[\u0600-\u06FFA-Za-z0-9._/,\-\s\u200C]*$/.test(value)
  }

  defaultMessage(args: ValidationArguments) {
    return 'The value must contain only Persian or English letters, numbers, and certain allowed symbols.'
  }
}

export function IsLettersAndNumbers(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'IsLettersAndNumbers',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: IsLettersAndNumbersConstraint,
    })
  }
}
