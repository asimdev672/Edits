@php
    use Botble\RealEstate\Repositories\Interfaces\ProjectInterface;

    $projects = collect([]);

    if (is_plugin_active('real-estate')) {
        $projects = app(ProjectInterface::class)->advancedGet([
            'condition' => [
                're_projects.is_featured' => true,
            ] + RealEstateHelper::getProjectDisplayQueryConditions(),
            'take'      => (int)theme_option('number_of_featured_projects', 4),
            'with'      => RealEstateHelper::getProjectRelationsQuery(),
            'order_by' => ['re_projects.created_at' => 'DESC'],
        ]);
     }
@endphp
@if ($projects->count())
    <div class="box_shadow" style="margin-top: 0;">
        <div class="container-fluid w90">
            <div class="projecthome">
                <div class="row">
                    <div class="col-12">
                        <h2>{!! BaseHelper::clean($title) !!}</h2>
                        @if ($subtitle)
                            <p style="margin: 0; margin-bottom: 10px">{!! BaseHelper::clean($subtitle) !!}</p>
                        @endif
                    </div>
                </div>
                <div class="row rowm10">
                    @foreach ($projects as $project)
                        <div class="col-6 col-sm-4  col-md-3 colm10">
                            {!! Theme::partial('real-estate.projects.item', compact('project')) !!}
                        </div>
                    @endforeach
                </div>
            </div>
        </div>
    </div>
@endif
