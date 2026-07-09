import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImprovementSuggestion } from '../entities/improvement-suggestion.entity';
import { SuggestionVote } from '../entities/suggestion-vote.entity';
import { SuggestionsService } from './suggestions.service';
import { SuggestionsController } from './suggestions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ImprovementSuggestion, SuggestionVote])],
  providers: [SuggestionsService],
  controllers: [SuggestionsController],
  exports: [SuggestionsService],
})
export class SuggestionsModule {}
