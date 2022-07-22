<?php

namespace Botble\Location;

use Botble\Base\Enums\BaseStatusEnum;
use Botble\Location\Repositories\Interfaces\CityInterface;
use Botble\Location\Repositories\Interfaces\StateInterface;

class Location
{
    /**
     * @var StateInterface
     */
    public $stateRepository;
    /**
     * @var CityInterface
     */
    public $cityRepository;

    /**
     * Location constructor.
     * @param StateInterface $stateRepository
     * @param CityInterface $cityRepository
     */
    public function __construct(StateInterface $stateRepository, CityInterface $cityRepository)
    {
        $this->stateRepository = $stateRepository;
        $this->cityRepository = $cityRepository;
    }

    /**
     * @return \Illuminate\Config\Repository|mixed
     */
    public function getStates()
    {
        $states = $this->stateRepository->advancedGet([
            'condition' => [
                'status' => BaseStatusEnum::PUBLISHED,
            ],
            'order_by'  => ['order' => 'ASC', 'name' => 'ASC'],
        ]);

        return $states->pluck('name', 'id')->all();
    }

    /**
     * @param $stateId
     * @return \Illuminate\Config\Repository|mixed
     */
    public function getCitiesByState($stateId)
    {
        $cities = $this->cityRepository->advancedGet([
            'condition' => [
                'status'   => BaseStatusEnum::PUBLISHED,
                'state_id' => $stateId,
            ],
            'order_by'  => ['order' => 'ASC', 'name' => 'ASC'],
        ]);

        return $cities->pluck('name', 'id')->all();
    }

    /**
     * @param $cityId
     * @return string
     */
    public function getCityNameById($cityId)
    {
        $city = $this->cityRepository->getFirstBy([
            'id'     => $cityId,
            'status' => BaseStatusEnum::PUBLISHED,
        ]);

        return $city ? $city->name : null;
    }

    /**
     * @param $stateId
     * @return string
     */
    public function getStateNameById($stateId)
    {
        $state = $this->stateRepository->getFirstBy([
            'id'     => $stateId,
            'status' => BaseStatusEnum::PUBLISHED,
        ]);

        return $state ? $state->name : null;
    }

    /**
     * @param string|BaseModel $model
     * @return bool
     */
    public static function isSupported($model): bool
    {
        if (!$model) {
            return false;
        }

        if (is_object($model)) {
            $model = get_class($model);
        }

        return in_array($model, self::supportedModels());
    }

    /**
     * @return int[]|string[]
     */
    public static function supportedModels(): array
    {
        return array_keys(self::getSupported());
    }

    /**
     * @return array
     */
    public static function getSupported(): array
    {
        return config('plugins.location.general.supported', []);
    }

    /**
     * @param string $model
     * @param array $keys
     * @return bool
     */
    public static function registerModule(string $model, array $keys = []): bool
    {
        $keys = array_filter(array_merge([
            'country' => 'country_id',
            'state'   => 'state_id',
            'city'    => 'city_id',
        ], $keys));

        config([
            'plugins.location.general.supported' => array_merge(self::getSupported(), [$model => $keys]),
        ]);

        return true;
    }
}
