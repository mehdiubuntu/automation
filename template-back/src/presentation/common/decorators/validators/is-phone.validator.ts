import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator'

@ValidatorConstraint({ name: 'IsPhone', async: false })
export class IsPhoneConstraint implements ValidatorConstraintInterface {
  validate(value: any) {
    if (typeof value !== 'string') return false

    // Accept common human formatting ("+44 (20) 7946-0958"), validate the digits.
    const digits = value.replace(/[\s().-]/g, '')

    // E.164-tolerant: optional +, 7-15 digits — works for any country.
    return /^\+?\d{7,15}$/.test(digits)
  }

  defaultMessage() {
    return 'Must be a valid phone number (7 to 15 digits, optionally starting with +).'
  }
}

export function IsPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsPhoneConstraint,
    })
  }
}
