import {
  IsNumber, IsString, IsEnum, Min, Max, MinLength, MaxLength,
  ValidateIf, Matches,
} from 'class-validator';
import { PixKeyType } from '../../entities/withdrawal.entity';

export class WithdrawDto {
  @IsNumber()
  @Min(10)
  @Max(10000)
  valueCC: number;

  @IsString()
  @MinLength(3)
  @MaxLength(150)
  pixKey: string;

  @IsEnum(PixKeyType)
  pixKeyType: PixKeyType;

  // Format validation per key type
  @ValidateIf(o => o.pixKeyType === PixKeyType.CPF)
  @Matches(/^\d{11}$/, { message: 'CPF deve conter exatamente 11 dígitos numéricos' })
  get cpfValidation() { return this.pixKey; }

  @ValidateIf(o => o.pixKeyType === PixKeyType.EMAIL)
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'E-mail inválido' })
  get emailValidation() { return this.pixKey; }

  @ValidateIf(o => o.pixKeyType === PixKeyType.PHONE)
  @Matches(/^\+55\d{10,11}$/, { message: 'Telefone deve estar no formato +5511999999999' })
  get phoneValidation() { return this.pixKey; }

  @ValidateIf(o => o.pixKeyType === PixKeyType.EVP)
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, { message: 'Chave EVP deve ser um UUID válido' })
  get evpValidation() { return this.pixKey; }
}

export class UpdatePixKeyDto {
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  pixKey: string;

  @IsEnum(PixKeyType)
  pixKeyType: PixKeyType;
}
