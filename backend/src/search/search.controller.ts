import { Controller, Get, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.dto';
import { CurrentUser } from '../auth/auth.guard';
import { SearchQueryDto, SearchResponse } from './search.dto';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /** `GET /search?q=` — titles and texts of the signed-in person only. */
  @Get()
  search(
    @CurrentUser() user: AuthUser,
    @Query() query: SearchQueryDto,
  ): Promise<SearchResponse> {
    return this.searchService.search(user.id, query.q);
  }
}
