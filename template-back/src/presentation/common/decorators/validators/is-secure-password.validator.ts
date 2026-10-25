import { isPasswordPolicySatisfied, passwordPolicyViolations } from '@domain/auth/policy/password.policy'
import { registerDecorator, ValidationArguments, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator'

@ValidatorConstraint({ name: 'IsSecurePassword', async: false })
export class IsSecurePasswordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return isPasswordPolicySatisfied(value)
  }

  defaultMessage(args: ValidationArguments) {
    const value: unknown = args.value
    if (typeof value !== 'string') return 'Password must be a string.'
    return `Password must contain ${passwordPolicyViolations(value).join(', ')}.`
  }
}

export function IsSecurePassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'IsSecurePassword',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: IsSecurePasswordConstraint,
    })
  }
}
